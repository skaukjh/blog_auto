import { generateBlogContentExpert } from '@/lib/openai/content-generator';
import { isValidExpertType } from '@/lib/experts/definitions';
import blogStyleCache from '@/lib/utils/blog-style-memory-cache';
import { getBlogStyleFromSupabase } from '@/lib/utils/style-storage';
import { getWritingGuide } from '@/lib/utils/writing-guide-storage';
import { ExpertCreateContentResponse, StyleScope } from '@/types';
import { NextRequest, NextResponse } from 'next/server';

/**
 * 이 전문가의 학습된 문체를 가져옵니다.
 *
 * 메모리 캐시 → Supabase 순으로 찾고, 해당 전문가 문체가 없으면 'common'으로
 * 폴백합니다. 어느 쪽도 없으면 null이며, 이 경우 페르소나 기본 톤으로 생성됩니다.
 */
async function loadStyleGuide(scope: StyleScope): Promise<string | null> {
  const cached = blogStyleCache.get(scope);
  if (cached) return cached;

  const stored = await getBlogStyleFromSupabase(scope);
  if (!stored) return null;

  blogStyleCache.set(stored.style, stored.scope, stored.sampleCount);
  return stored.style;
}

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

    // 이 전문가로 학습해 둔 문체를 불러옵니다 (없으면 common → null 순으로 폴백)
    const scope: StyleScope = isValidExpertType(expertType) ? expertType : 'common';

    // 문체(어떻게 쓰는가)와 구조 가이드(어떤 틀로 쓰는가)는 별개로 불러옵니다.
    // 둘 다 저장된 것을 읽기만 하며, 여기서 재분석하지 않습니다.
    const [styleGuide, writingGuide] = await Promise.all([
      loadStyleGuide(scope),
      getWritingGuide(),
    ]);

    if (!styleGuide) {
      console.warn(`⚠️ ${scope} 문체가 없어 페르소나 기본 톤으로 생성합니다`);
    }
    if (!writingGuide) {
      console.log('ℹ️ 저장된 글쓰기 가이드가 없어 구조 지시 없이 생성합니다');
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
      placeInfo,
      styleGuide,
      writingGuide?.guide ?? null,
      // 가이드가 종결어미를 지배하도록 설정된 경우, 학습 문체보다 우선합니다.
      writingGuide?.endingPattern ?? null
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
