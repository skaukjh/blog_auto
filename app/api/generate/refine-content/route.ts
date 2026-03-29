// ⭐ runtime은 반드시 import보다 먼저 선언해야 함
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { refineBlogContent } from "@/lib/openai/content-generator";
import type { ImageAnalysisResult, KeywordItem, PlaceInfo } from "@/types/index";

interface RefineContentRequest {
  currentContent: string;
  userRequest: string;
  keywords: KeywordItem[];
  imageAnalysis: ImageAnalysisResult;
  placeInfo?: PlaceInfo;
}

interface RefineContentResponse {
  success: boolean;
  refinedContent?: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<RefineContentResponse>> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: "OPENAI_API_KEY가 설정되지 않았습니다",
        },
        { status: 500 }
      );
    }

    const body: RefineContentRequest = await request.json();
    const { currentContent, userRequest, keywords, imageAnalysis, placeInfo } = body;

    // 입력 검증
    if (!currentContent || !currentContent.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "현재 콘텐츠가 필요합니다",
        },
        { status: 400 }
      );
    }

    if (!userRequest || !userRequest.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "수정 요청이 필요합니다",
        },
        { status: 400 }
      );
    }

    if (!keywords || keywords.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "키워드가 필요합니다",
        },
        { status: 400 }
      );
    }

    if (!imageAnalysis) {
      return NextResponse.json(
        {
          success: false,
          error: "이미지 분석 정보가 필요합니다",
        },
        { status: 400 }
      );
    }

    // 콘텐츠 수정
    const refinedContent = await refineBlogContent(
      currentContent,
      userRequest,
      keywords,
      imageAnalysis,
      placeInfo
    );

    return NextResponse.json(
      {
        success: true,
        refinedContent,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("콘텐츠 수정 API 오류:", error);
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다";

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
