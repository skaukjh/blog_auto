import { NextRequest, NextResponse } from 'next/server';
import { searchNaverShopping } from '@/lib/search/product-search';
import { checkRateLimit } from '@/lib/utils/rate-limiter';
import { ProductSearchResult } from '@/types';

interface ProductSearchResponse {
  success: boolean;
  results: ProductSearchResult[];
  query?: string;
  error?: string;
}

/**
 * POST /api/products/search
 * Naver 쇼핑 API로 제품 검색
 *
 * Request: { query: string }
 * Response: { success: boolean, results: ProductSearchResult[], query: string }
 */
export async function POST(request: NextRequest): Promise<NextResponse<ProductSearchResponse>> {
  try {
    // Rate Limiting 체크
    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('cf-connecting-ip') ||
      'unknown';
    if (!checkRateLimit(ip, 10)) {
      return NextResponse.json(
        {
          success: false,
          results: [],
          error: '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
        },
        { status: 429 }
      );
    }

    // 입력 검증
    const body = await request.json();
    const { query } = body;

    if (typeof query !== 'string' || query.trim().length === 0 || query.length > 100) {
      return NextResponse.json(
        {
          success: false,
          results: [],
          error: '검색 쿼리는 1자 이상 100자 이하여야 합니다.',
        },
        { status: 400 }
      );
    }

    const results = await searchNaverShopping(query.trim(), 5);

    return NextResponse.json({
      success: true,
      results,
      query: query.trim(),
    });
  } catch (error) {
    console.error('Product search API error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      {
        success: false,
        results: [],
        error: error instanceof Error ? error.message : '제품 검색 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
