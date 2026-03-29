import OpenAI from 'openai';
import { ExpertType, RecommendationItem, RecommendationRequest } from '@/types';
import { webSearch } from './web-search';
import { RECOMMENDATION_QUERY_TEMPLATES } from '@/lib/experts/definitions';

/**
 * Phase 20: 추천 시스템
 * 전문가별 추천 아이템 검색
 */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * 추천 쿼리 생성
 */
function generateRecommendationQuery(
  expertType: ExpertType,
  query: string,
  recommendationType: 'nearby' | 'related' | 'destination'
): string {
  const templates = RECOMMENDATION_QUERY_TEMPLATES[expertType];

  if (recommendationType === 'nearby' && templates.nearby) {
    return templates.nearby.replace('{location}', query);
  } else if (recommendationType === 'related' && templates.related) {
    return templates.related.replace('{location}', query).replace('{keyword}', query).replace('{cuisine}', query);
  } else if (recommendationType === 'destination' && templates.destination) {
    return templates.destination.replace('{location}', query);
  }

  return query;
}

/**
 * 추천 아이템 검색
 */
export async function getRecommendations(req: RecommendationRequest): Promise<RecommendationItem[]> {
  try {
    const searchQuery = generateRecommendationQuery(req.expertType, req.query, req.recommendationType);

    if (!searchQuery) {
      console.warn(`No recommendation query generated for ${req.expertType} ${req.recommendationType}`);
      return [];
    }

    // 웹 검색
    const searchResults = await webSearch(searchQuery, 'naver', Math.min(req.limit || 5, 10));

    // 검색 결과를 추천 아이템으로 변환
    const recommendations = await parseSearchResultsAsRecommendations(
      searchResults,
      req.expertType,
      req.recommendationType
    );

    return recommendations.slice(0, req.limit || 5);
  } catch (error) {
    console.error('Recommendation search error:', error);
    return [];
  }
}

/**
 * 검색 결과를 추천 아이템으로 파싱
 */
async function parseSearchResultsAsRecommendations(
  searchResults: Array<{ title: string; url: string; snippet: string }>,
  expertType: ExpertType,
  recommendationType: 'nearby' | 'related' | 'destination'
): Promise<RecommendationItem[]> {
  try {
    const searchResultsText = searchResults
      .map((r) => `${r.title}\n${r.snippet}`)
      .join('\n\n---\n\n');

    let prompt = '';

    switch (expertType) {
      case 'restaurant':
        prompt = `아래 검색 결과에서 맛집 정보를 추출하고 JSON 형식으로 반환하세요.

검색 결과:
${searchResultsText}

각 결과에서 다음 정보를 추출하세요:
- 음식점 이름 (title)
- 음식 종류 또는 특징 (description)
- 평점 또는 평판 (rating - 없으면 null)
- 주소 (address - 있으면 포함, 없으면 null)

JSON 형식:
{
  "recommendations": [
    {
      "title": "음식점 이름",
      "type": "restaurant",
      "description": "음식 종류와 특징",
      "rating": 4.5,
      "address": "주소"
    }
  ]
}

최대 5개만 추출하세요.`;
        break;

      case 'product':
        prompt = `아래 검색 결과에서 제품 정보를 추출하고 JSON 형식으로 반환하세요.

검색 결과:
${searchResultsText}

각 결과에서 다음 정보를 추출하세요:
- 제품 이름 (title)
- 제품 특징 또는 설명 (description)
- 가격대 또는 평점 (rating - 있으면 포함, 없으면 null)

JSON 형식:
{
  "recommendations": [
    {
      "title": "제품 이름",
      "type": "product",
      "description": "제품 특징 및 설명",
      "rating": null
    }
  ]
}

최대 5개만 추출하세요.`;
        break;

      case 'travel':
        if (recommendationType === 'nearby') {
          prompt = `아래 검색 결과에서 관광지 정보를 추출하고 JSON 형식으로 반환하세요.

검색 결과:
${searchResultsText}

각 결과에서 다음 정보를 추출하세요:
- 관광지 이름 (title)
- 관광지 설명 및 특징 (description)
- 주소 (address - 있으면 포함)

JSON 형식:
{
  "recommendations": [
    {
      "title": "관광지 이름",
      "type": "place",
      "description": "관광지 설명",
      "address": "주소"
    }
  ]
}

최대 5개만 추출하세요.`;
        } else {
          // destination
          prompt = `아래 검색 결과에서 여행 목적지 정보를 추출하고 JSON 형식으로 반환하세요.

검색 결과:
${searchResultsText}

각 결과에서 다음 정보를 추출하세요:
- 지역/목적지 이름 (title)
- 여행 특징 및 추천 이유 (description)

JSON 형식:
{
  "recommendations": [
    {
      "title": "목적지 이름",
      "type": "place",
      "description": "여행 특징 및 추천 이유"
    }
  ]
}

최대 5개만 추출하세요.`;
        }
        break;

      case 'living':
        prompt = `아래 검색 결과에서 추천 제품/스타일 정보를 추출하고 JSON 형식으로 반환하세요.

검색 결과:
${searchResultsText}

각 결과에서 다음 정보를 추출하세요:
- 제품/스타일 이름 (title)
- 특징 및 설명 (description)
- 평점 또는 인기도 (rating - 있으면 포함, 없으면 null)

JSON 형식:
{
  "recommendations": [
    {
      "title": "제품/스타일 이름",
      "type": "product",
      "description": "특징 및 설명",
      "rating": null
    }
  ]
}

최대 5개만 추출하세요.`;
        break;
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1000,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.choices[0]?.message?.content || '{}';

    // JSON 파싱 (더 안전하고 신뢰할 수 있음)
    let data: { recommendations?: RecommendationItem[] } = { recommendations: [] };
    try {
      data = JSON.parse(content);
    } catch (parseError) {
      console.error('JSON parse error:', parseError instanceof Error ? parseError.message : 'Unknown error');
      return [];
    }

    const recommendations: RecommendationItem[] = (data.recommendations || []).map((item) => {
      const itemType = String(item.type || 'product');
      const validTypes: ('restaurant' | 'product' | 'place' | 'dish')[] = ['restaurant', 'product', 'place', 'dish'];
      const type = (validTypes.includes(itemType as any) ? itemType : 'product') as 'restaurant' | 'product' | 'place' | 'dish';

      return {
        title: String(item.title || ''),
        type,
        description: String(item.description || ''),
        rating: typeof item.rating === 'number' ? item.rating : undefined,
        address: item.address ? String(item.address) : undefined,
        url: item.url ? String(item.url) : '',
      };
    });

    return recommendations;
  } catch (error) {
    console.error('Parse recommendations error:', error);
    return [];
  }
}

/**
 * 추천 아이템 포맷팅 (콘텐츠 생성용)
 */
export function formatRecommendationsForPrompt(recommendations: RecommendationItem[]): string {
  if (recommendations.length === 0) {
    return '';
  }

  return `
추천 아이템:
${recommendations
  .map(
    (rec, idx) =>
      `${idx + 1}. ${rec.title}
   설명: ${rec.description}
   ${rec.rating ? `평점: ${rec.rating}` : ''}
   ${rec.address ? `주소: ${rec.address}` : ''}`
  )
  .join('\n')}

위 추천 아이템들을 자연스럽게 콘텐츠에 포함시키세요.
  `.trim();
}
