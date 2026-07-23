// ⭐ runtime은 반드시 import보다 먼저 선언해야 함
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import blogStyleCache from "@/lib/utils/blog-style-memory-cache";
import { getBlogStyleFromSupabase } from "@/lib/utils/style-storage";

export async function GET() {
  try {
    // 1. 메모리 캐시에서 먼저 확인
    const cachedStyle = blogStyleCache.get();

    if (cachedStyle) {
      console.log("📦 메모리 캐시에서 스타일 로드");
      return NextResponse.json(
        {
          success: true,
          style: cachedStyle,
          exists: true,
          source: "memory",
          cacheInfo: blogStyleCache.getInfo(),
        },
        { status: 200 }
      );
    }

    // 2. Supabase에서 조회 (메모리 캐시가 없을 경우)
    console.log("🔍 Supabase에서 스타일 조회 중...");
    const dbData = await getBlogStyleFromSupabase();

    if (dbData) {
      // DB에서 읽은 스타일을 메모리 캐시에 저장
      try {
        blogStyleCache.set(dbData.style);
        console.log("💾 Supabase 스타일을 메모리 캐시에 저장");
      } catch (cacheErr) {
        console.warn("⚠️ 메모리 캐시 저장 실패:", cacheErr);
      }

      return NextResponse.json(
        {
          success: true,
          style: dbData.style,
          exists: true,
          source: "supabase",
          analyzedAt: dbData.analyzedAt,
        },
        { status: 200 }
      );
    }

    // 3. 저장된 스타일이 없음
    console.log("ℹ️ 저장된 스타일이 없습니다");
    return NextResponse.json(
      {
        success: false,
        style: null,
        exists: false,
        message: "저장된 스타일이 없습니다",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("스타일 조회 오류:", error);
    return NextResponse.json(
      {
        success: false,
        style: null,
        exists: false,
      },
      { status: 200 }
    );
  }
}
