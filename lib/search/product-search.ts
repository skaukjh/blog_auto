import { ProductSearchResult } from '@/types';
import { stripHtmlTags } from '@/lib/utils/html-strip';

/**
 * Phase 24: 제품 후기 전문가 - Naver 쇼핑 API 검색
 */

interface NaverShoppingItem {
  title: string;
  link: string;
  image: string;
  lprice: string;   // 최저가 (문자열)
  hprice: string;   // 최고가 (문자열, 없으면 빈 문자열)
  mallName: string; // 판매처
  brand: string;    // 브랜드
  category1: string;
  category2: string;
  category3: string;
  category4: string;
}

interface NaverShoppingResponse {
  lastBuildDate: string;
  total: number;
  start: number;
  display: number;
  items: NaverShoppingItem[];
}

/**
 * 카테고리 조합 (빈 값 제외)
 */
function buildCategory(item: NaverShoppingItem): string | undefined {
  const parts = [item.category1, item.category2, item.category3, item.category4].filter(
    (c) => c && c.trim().length > 0
  );
  return parts.length > 0 ? parts.join(' > ') : undefined;
}

/**
 * Naver 쇼핑 API로 제품 검색
 * Naver 쇼핑 API는 별점 미제공 → rating: undefined
 */
export async function searchNaverShopping(
  query: string,
  limit = 5
): Promise<ProductSearchResult[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Naver API credentials not configured');
  }

  const url = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=${limit}&sort=sim`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
    },
  });

  if (!response.ok) {
    throw new Error(`Naver Shopping API error: ${response.status}`);
  }

  const data: NaverShoppingResponse = await response.json();

  return data.items.map((item): ProductSearchResult => ({
    title: stripHtmlTags(item.title),
    lprice: parseInt(item.lprice, 10) || 0,
    hprice: item.hprice ? parseInt(item.hprice, 10) : undefined,
    mallName: stripHtmlTags(item.mallName),
    brand: item.brand ? stripHtmlTags(item.brand) : undefined,
    image: item.image || undefined,
    link: item.link,
    rating: undefined, // Naver 쇼핑 API 미제공
    category: buildCategory(item),
  }));
}
