import { WebSearchResult } from '@/types';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Phase 20: 웹 검색 통합
 * 네이버 + 구글 검색 API 지원
 */

interface NaverSearchResponse {
  items: Array<{
    title: string;
    link: string;
    description: string;
  }>;
}

interface GoogleSearchResponse {
  items: Array<{
    title: string;
    link: string;
    snippet: string;
  }>;
}

/**
 * 네이버 검색 API
 */
export async function searchNaver(query: string, limit: number = 5): Promise<WebSearchResult[]> {
  try {
    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Naver API credentials not configured');
    }

    const url = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(query)}&display=${limit}&sort=sim`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    });

    if (!response.ok) {
      throw new Error(`Naver API error: ${response.status}`);
    }

    const data: NaverSearchResponse = await response.json();

    return data.items.map((item) => ({
      title: stripHtmlTags(item.title),
      url: item.link,
      snippet: stripHtmlTags(item.description),
      source: 'naver' as const,
    }));
  } catch (error) {
    console.error('Naver search failed:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

/**
 * 구글 검색 API (Custom Search)
 */
export async function searchGoogle(query: string, limit: number = 5): Promise<WebSearchResult[]> {
  try {
    const cseId = process.env.GOOGLE_CSE_ID;
    const apiKey = process.env.GOOGLE_CSE_API_KEY;

    if (!cseId || !apiKey) {
      throw new Error('Google CSE credentials not configured');
    }

    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=${encodeURIComponent(query)}&num=${Math.min(limit, 10)}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Google API error: ${response.status}`);
    }

    const data: GoogleSearchResponse = await response.json();

    if (!data.items) {
      return [];
    }

    return data.items.slice(0, limit).map((item) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      source: 'google' as const,
    }));
  } catch (error) {
    console.error('Google search failed:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

/**
 * 통합 검색 함수 (단일 엔진)
 */
export async function webSearch(
  query: string,
  searchEngine: 'naver' | 'google' = 'naver',
  limit: number = 5
): Promise<WebSearchResult[]> {
  if (searchEngine === 'naver') {
    return searchNaver(query, limit);
  } else {
    return searchGoogle(query, limit);
  }
}

/**
 * 동시 검색 함수 (Naver + Google)
 * Phase 20: 두 검색 엔진에서 동시에 검색하여 결과 통합
 */
export async function webSearchBoth(
  query: string,
  limit: number = 5
): Promise<WebSearchResult[]> {
  try {
    // Naver와 Google에서 동시에 검색
    const [naverResults, googleResults] = await Promise.allSettled([
      searchNaver(query, limit),
      searchGoogle(query, limit),
    ]).then((results) => [
      results[0].status === 'fulfilled' ? results[0].value : [],
      results[1].status === 'fulfilled' ? results[1].value : [],
    ]);

    // 결과 병합 (중복 제거)
    const combined = [...naverResults, ...googleResults];
    const uniqueResults = Array.from(
      new Map(combined.map((item) => [item.url, item])).values()
    );

    return uniqueResults.slice(0, limit * 2); // 각 엔진당 limit개씩, 최대 limit*2개
  } catch (error) {
    console.error('Dual search error:', error);
    // 실패해도 에러 throw하지 않고, 부분 결과 반환
    return [];
  }
}

/**
 * HTML 태그 제거 및 XSS 방지
 * DOMPurify를 사용하여 안전하게 sanitize
 */
function stripHtmlTags(html: string): string {
  try {
    // DOMPurify로 안전하게 sanitize (모든 태그 제거)
    const clean = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    });

    // HTML entity 디코딩
    return clean
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  } catch (error) {
    console.error('HTML sanitization failed:', error instanceof Error ? error.message : 'Unknown error');
    // 실패 시 기본 방법으로 폴백
    return html.replace(/<[^>]*>/g, '').trim();
  }
}

/**
 * 웹 검색 결과 요약
 */
export function summarizeSearchResults(results: WebSearchResult[]): string {
  return results
    .map(
      (result, idx) => `
[결과 ${idx + 1}]
제목: ${result.title}
URL: ${result.url}
요약: ${result.snippet}
    `
    )
    .join('\n');
}
