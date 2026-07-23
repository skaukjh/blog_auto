// ⭐ runtime은 반드시 import보다 먼저 선언해야 함
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import blogStyleCache from "@/lib/utils/blog-style-memory-cache";
import { getBlogStyleFromFile } from "@/lib/utils/style-storage";

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

    // 2. data/blog-style.txt 에서 조회 (메모리 캐시가 없을 경우)
    console.log("🔍 data/blog-style.txt 에서 스타일 조회 중...");
    const fileData = getBlogStyleFromFile();

    if (fileData) {
      // 파일에서 읽은 스타일을 메모리 캐시에 저장
      try {
        blogStyleCache.set(fileData.style);
        console.log("💾 파일 스타일을 메모리 캐시에 저장");
      } catch (cacheErr) {
        console.warn("⚠️ 메모리 캐시 저장 실패:", cacheErr);
      }

      return NextResponse.json(
        {
          success: true,
          style: fileData.style,
          exists: true,
          source: "file",
          analyzedAt: fileData.analyzedAt,
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
