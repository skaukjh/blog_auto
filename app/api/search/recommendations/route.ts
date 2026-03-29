import { getRecommendations } from '@/lib/search/recommendations';
import { RecommendationResponse } from '@/types';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/utils/rate-limiter';

/**
 * POST /api/search/recommendations
 * 전문가별 추천 아이템 검색
 *
 * Request:
 * {
 *   query: string,
 *   expertType: 'restaurant' | 'product' | 'travel' | 'fashion' | 'living',
 *   recommendationType: 'nearby' | 'related' | 'destination',
 *   limit?: number
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse<RecommendationResponse>> {
  try {
    // 1️⃣ Rate Limiting 체크
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || 'unknown';
    if (!checkRateLimit(ip, 10)) {
      return NextResponse.json(
        {
          success: false,
          recommendations: [],
          expertType: 'restaurant',
          error: '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
        } as RecommendationResponse,
        { status: 429 }
      );
    }

    // 2️⃣ 입력 검증
    const body = await request.json();
    const { query, expertType, recommendationType, limit = 5 } = body;

    // 쿼리 검증
    if (typeof query !== 'string' || query.length === 0 || query.length > 200) {
      return NextResponse.json(
        {
          success: false,
          recommendations: [],
          expertType: expertType || 'restaurant',
          error: '검색 쿼리는 1자 이상 200자 이하여야 합니다.',
        } as RecommendationResponse,
        { status: 400 }
      );
    }

    // expertType 검증
    const validExpertTypes = ['restaurant', 'product', 'travel', 'fashion', 'living'];
    if (!validExpertTypes.includes(expertType)) {
      return NextResponse.json(
        {
          success: false,
          recommendations: [],
          expertType: 'restaurant',
          error: `전문가 타입은 ${validExpertTypes.join(', ')} 중 하나여야 합니다.`,
        } as RecommendationResponse,
        { status: 400 }
      );
    }

    // recommendationType 검증 (선택사항)
    if (recommendationType) {
      const validRecommendationTypes = ['nearby', 'related', 'destination'];
      if (!validRecommendationTypes.includes(recommendationType)) {
        return NextResponse.json(
          {
            success: false,
            recommendations: [],
            expertType,
            error: `추천 타입은 ${validRecommendationTypes.join(', ')} 중 하나여야 합니다.`,
          } as RecommendationResponse,
          { status: 400 }
        );
      }
    }

    // limit 검증
    if (typeof limit !== 'number' || limit < 1 || limit > 10) {
      return NextResponse.json(
        {
          success: false,
          recommendations: [],
          expertType,
          error: '추천 아이템 개수는 1개 이상 10개 이하여야 합니다.',
        } as RecommendationResponse,
        { status: 400 }
      );
    }

    // 추천 검색
    const recommendations = await getRecommendations({
      query,
      expertType,
      recommendationType,
      limit,
    });

    return NextResponse.json({
      success: true,
      recommendations,
      expertType,
    });
  } catch (error) {
    console.error('Recommendations API error:', error instanceof Error ? error.message : 'Unknown error');
    const errorMessage = error instanceof Error ? error.message : '추천 검색 중 오류가 발생했습니다';

    return NextResponse.json(
      {
        success: false,
        recommendations: [],
        expertType: 'restaurant',
        error: errorMessage,
      } as RecommendationResponse,
      { status: 500 }
    );
  }
}
