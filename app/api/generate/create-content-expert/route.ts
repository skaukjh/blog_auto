import { generateBlogContentExpert } from '@/lib/openai/content-generator';
import { isValidExpertType } from '@/lib/experts/definitions';
import blogStyleCache from '@/lib/utils/blog-style-memory-cache';
import { getBlogStyleFromSupabase } from '@/lib/utils/style-storage';
import { getWritingGuide } from '@/lib/utils/writing-guide-storage';
import { MAX_SUBHEADINGS, MIN_SUBHEADINGS } from '@/lib/utils/outline';
import { toKrw } from '@/lib/openai/pricing';
import { ExpertCreateContentResponse, StyleScope } from '@/types';
import { NextRequest, NextResponse } from 'next/server';

/** 실패 응답을 만드는 도우미 (본문 형태를 매번 반복하지 않기 위해) */
function errorResponse(message: string, status: number) {
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
      error: message,
    } as ExpertCreateContentResponse,
    { status }
  );
}

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
 *   title: string,                 // 글 제목 - 토씨 하나 바꾸지 않고 글에 그대로 들어갑니다
 *   subheadings: string[],         // 소제목 3~10개 - 순서·표기 그대로, 각 소제목 밑에 해당 내용
 *   length: 'short' | 'medium' | 'long',
 *   keywords: { text: string, count: number }[],
 *   imageAnalysis: ImageAnalysisResult,
 *   expertType: 'restaurant' | 'product' | 'travel' | 'fashion' | 'living',
 *   modelConfig: { ... },
 *   webSearchResults?: WebSearchResult[],
 *   recommendations?: RecommendationItem[],
 *   startSentence?: string,
 *   endSentence?: string,
 *   placeInfo?: PlaceInfo,
 *   personalExperience?: string   // 사용자가 직접 입력한 실제 경험 (빠짐없이 반영)
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse<ExpertCreateContentResponse>> {
  try {
    const body = await request.json();
    const {
      title,
      subheadings,
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
      personalExperience,
    } = body;

    if (!title || !length || !keywords || !imageAnalysis || !expertType || !modelConfig) {
      return errorResponse('필수 파라미터가 부족합니다', 400);
    }

    // 소제목은 글의 골격이므로 개수를 서버에서도 확인합니다.
    const cleanSubheadings: string[] = Array.isArray(subheadings)
      ? subheadings.map((s: unknown) => String(s ?? '').trim()).filter(Boolean)
      : [];

    if (
      cleanSubheadings.length < MIN_SUBHEADINGS ||
      cleanSubheadings.length > MAX_SUBHEADINGS
    ) {
      return errorResponse(
        `소제목은 ${MIN_SUBHEADINGS}~${MAX_SUBHEADINGS}개를 입력해야 합니다 (현재 ${cleanSubheadings.length}개)`,
        400
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
    const content = await generateBlogContentExpert({
      title,
      subheadings: cleanSubheadings,
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
      writingGuide: writingGuide?.guide ?? null,
      // 가이드가 종결어미를 지배하도록 설정된 경우, 학습 문체보다 우선합니다.
      forcedEnding: writingGuide?.endingPattern ?? null,
      // 사용자가 직접 입력한 실제 경험 — 빠짐없이 글에 반영됩니다.
      personalExperience: personalExperience ?? null,
    });

    // 실제 비용 계산.
    //
    // 과거에는 입력·출력 토큰을 2000으로 하드코딩해 추정했기 때문에 화면 금액이
    // 실제 청구액과 무관했습니다. 지금은 두 단계 모두 응답의 usage를 그대로 씁니다.
    // (이미지 분석 usage는 클라이언트가 분석 응답에서 받아 그대로 넘겨줍니다.)
    const imageUsd = imageAnalysis?.usage?.usd ?? 0;
    const contentUsd = content.usage?.usd ?? 0;
    const totalUsd = imageUsd + contentUsd;

    console.log(
      `💸 실제 비용: 이미지 ${toKrw(imageUsd)}원 + 본문 ${toKrw(contentUsd)}원 = ${toKrw(totalUsd)}원` +
        ` (본문 ${content.usage?.inputTokens ?? 0}in/${content.usage?.outputTokens ?? 0}out 토큰, ${content.wordCount}자)`
    );

    return NextResponse.json({
      success: true,
      content,
      expertType,
      cost: {
        usd: totalUsd,
        krw: toKrw(totalUsd),
        breakdown: {
          imageAnalysis: { usd: imageUsd, krw: toKrw(imageUsd) },
          contentGeneration: { usd: contentUsd, krw: toKrw(contentUsd) },
        },
      },
    });
  } catch (error) {
    console.error('Expert content generation API error:', error);
    const errorMessage = error instanceof Error ? error.message : '콘텐츠 생성 중 오류가 발생했습니다';

    return errorResponse(errorMessage, 500);
  }
}
