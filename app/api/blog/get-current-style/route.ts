// ⭐ runtime은 반드시 import보다 먼저 선언해야 함
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { isValidExpertType } from "@/lib/experts/definitions";
import blogStyleCache from "@/lib/utils/blog-style-memory-cache";
import { getBlogStyleFromSupabase, getAllBlogStyles } from "@/lib/utils/style-storage";
import type { StyleScope } from "@/types/index";

/**
 * 저장된 문체를 조회합니다.
 *
 * - `?expertType=restaurant` : 해당 전문가의 문체 (없으면 common으로 폴백)
 * - `?all=true`              : 저장된 모든 전문가의 문체 현황 (/format 화면용)
 * - 파라미터 없음             : common 문체
 */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;

    // 전체 현황 조회
    if (params.get("all") === "true") {
      const styles = await getAllBlogStyles();
      return NextResponse.json(
        {
          success: true,
          styles: Object.fromEntries(
            Object.entries(styles).map(([scope, value]) => [
              scope,
              {
                analyzedAt: value.analyzedAt,
                sampleCount: value.sampleCount,
                preview: value.style.slice(0, 200),
                /** 분석 결과 전문. /format 재방문 시 그대로 다시 보여줍니다 */
                style: value.style,
                /** 분석에 사용한 예시글 원문 (마이그레이션 004 이후 저장분만 존재) */
                samples: value.samples ?? null,
              },
            ])
          ),
        },
        { status: 200 }
      );
    }

    const requested = params.get("expertType");
    const scope: StyleScope = isValidExpertType(requested) ? requested : "common";

    // 1. 메모리 캐시 (해당 scope → common 순으로 폴백)
    const cachedStyle = blogStyleCache.get(scope);
    if (cachedStyle) {
      return NextResponse.json(
        {
          success: true,
          style: cachedStyle,
          exists: true,
          source: "memory",
          scope,
          cacheInfo: blogStyleCache.getInfo(scope),
        },
        { status: 200 }
      );
    }

    // 2. Supabase 조회 (내부에서 common 폴백까지 처리)
    const dbData = await getBlogStyleFromSupabase(scope);
    if (dbData) {
      // 실제로 읽어온 scope 기준으로 캐시에 넣습니다.
      blogStyleCache.set(dbData.style, dbData.scope, dbData.sampleCount);

      return NextResponse.json(
        {
          success: true,
          style: dbData.style,
          exists: true,
          source: "supabase",
          scope: dbData.scope,
          /** 요청한 전문가 문체가 없어 폴백됐는지 여부 */
          fallback: dbData.scope !== scope,
          analyzedAt: dbData.analyzedAt,
          sampleCount: dbData.sampleCount,
        },
        { status: 200 }
      );
    }

    // 3. 저장된 문체 없음
    return NextResponse.json(
      {
        success: false,
        style: null,
        exists: false,
        scope,
        message: "저장된 문체가 없습니다",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("문체 조회 오류:", error);
    return NextResponse.json(
      { success: false, style: null, exists: false },
      { status: 200 }
    );
  }
}
