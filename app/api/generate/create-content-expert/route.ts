import { generateBlogContentExpert } from '@/lib/openai/content-generator';
import { ExpertCreateContentResponse } from '@/types';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/generate/create-content-expert
 * 전문가 기반 콘텐츠 생성
 *
 * Request:
 * {
 *   topic: string,
 *   length: 'short' | 'medium' | 'long',
 *   keywords: { text: string, count: number }[],
 *   imageAnalysis: ImageAnalysisResult,
 *   expertType: 'restaurant' | 'product' | 'travel' | 'fashion' | 'living',
 *   modelConfig: { ... },
 *   webSearchResults?: WebSearchResult[],
 *   recommendations?: RecommendationItem[],
 *   startSentence?: string,
 *   endSentence?: string,
 *   placeInfo?: PlaceInfo
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse<ExpertCreateContentResponse>> {
  try {
    const body = await request.json();
    const {
      topic,
      length,
      keywords,
      imageAnalysis,
      expertType,
      modelConfig,
      webSearchResults,
      recommendations,
      startSentence,
      endSentence,
      placeInfo,
    } = body;

    if (!topic || !length || !keywords || !imageAnalysis || !expertType || !modelConfig) {
      return NextResponse.json(
        {
          success: false,
          content: {
            content: '',
            imageGuides: [],
            wordCount: 0,
            keywordCounts: {},
          },
          expertType: 'restaurant',
          error: '필수 파라미터가 부족합니다',
        } as ExpertCreateContentResponse,
        { status: 400 }
      );
    }

    // 전문가 콘텐츠 생성
    const content = await generateBlogContentExpert(
      topic,
      length,
      keywords,
      imageAnalysis,
      expertType,
      modelConfig,
      webSearchResults,
      recommendations,
      startSentence,
      endSentence,
      placeInfo
    );

    // 비용 추정 (대략값)
    const inputTokens = 2000;
    const outputTokens = 2000;
    let costUsd = 0;

    // 모델별 가격 추정
    if (modelConfig.contentGenerationModel.includes('gpt-5')) {
      costUsd = (inputTokens / 1000000) * 5 + (outputTokens / 1000000) * 15;
    } else if (modelConfig.contentGenerationModel.includes('gpt-4')) {
      costUsd = (inputTokens / 1000000) * 2.5 + (outputTokens / 1000000) * 10;
    } else if (modelConfig.contentGenerationModel.includes('claude')) {
      costUsd = (inputTokens / 1000000) * 15 + (outputTokens / 1000000) * 75;
    } else if (modelConfig.contentGenerationModel.includes('gemini')) {
      costUsd = (inputTokens / 1000000) * 1.25 + (outputTokens / 1000000) * 5;
    }

    const costKrw = Math.round(costUsd * 1300); // 환율: 1 USD = 1,300 KRW

    return NextResponse.json({
      success: true,
      content,
      expertType,
      cost: {
        usd: costUsd,
        krw: costKrw,
      },
    });
  } catch (error) {
    console.error('Expert content generation API error:', error);
    const errorMessage = error instanceof Error ? error.message : '콘텐츠 생성 중 오류가 발생했습니다';

    return NextResponse.json(
      {
        success: false,
        content: {
          content: '',
          imageGuides: [],
          wordCount: 0,
          keywordCounts: {},
        },
        expertType: 'restaurant',
        error: errorMessage,
      } as ExpertCreateContentResponse,
      { status: 500 }
    );
  }
}
