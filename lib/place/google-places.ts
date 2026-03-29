import axios from 'axios';
import type { PlaceInfo } from '@/types/index';

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

if (!GOOGLE_PLACES_API_KEY) {
  console.warn('GOOGLE_PLACES_API_KEY가 설정되지 않았습니다');
}

interface GoogleReview {
  author_name: string;
  rating: number;
  text: string;
  time: number; // Unix timestamp
}

interface GooglePlaceResult {
  name: string;
  formatted_address: string;
  formatted_phone_number?: string;
  opening_hours?: {
    weekday_text: string[];
  };
  rating?: number;
  website?: string;
  reviews?: GoogleReview[];
}

/**
 * Google Places API로 가게 검색
 */
export async function searchPlace(placeName: string): Promise<PlaceInfo | null> {
  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error('Google Places API Key가 설정되지 않았습니다');
  }

  try {
    // 1단계: Place Search (Text Search)
    const searchResponse = await axios.get(
      'https://maps.googleapis.com/maps/api/place/textsearch/json',
      {
        params: {
          query: `${placeName} 대한민국`,
          key: GOOGLE_PLACES_API_KEY,
          language: 'ko',
        },
      }
    );

    const results = searchResponse.data.results;
    if (!results || results.length === 0) {
      return null;
    }

    const placeId = results[0].place_id;

    // 2단계: Place Details (상세 정보 + 리뷰)
    const detailsResponse = await axios.get(
      'https://maps.googleapis.com/maps/api/place/details/json',
      {
        params: {
          place_id: placeId,
          fields: 'name,formatted_address,formatted_phone_number,opening_hours,rating,website,reviews',
          key: GOOGLE_PLACES_API_KEY,
          language: 'ko',
        },
      }
    );

    const place: GooglePlaceResult = detailsResponse.data.result;

    // 주차 정보 추정 (Google Places에서 직접 제공 안 됨)
    const parking = estimateParking(place.formatted_address);

    // 대중교통 정보 생성 (간단한 형태)
    const nearbyTransit = generateTransitInfo(place.formatted_address);

    return formatPlaceInfo(place, parking, nearbyTransit);
  } catch (error) {
    console.error('Google Places API 오류:', error);
    return null;
  }
}

/**
 * PlaceInfo 형식으로 변환
 */
function formatPlaceInfo(
  place: GooglePlaceResult,
  parking: string,
  nearbyTransit: string
): PlaceInfo {
  // 리뷰 변환 (최대 5개, API 한계)
  const reviews = place.reviews
    ? place.reviews.slice(0, 5).map((review) => ({
        author: review.author_name,
        rating: review.rating,
        text: review.text,
        time: new Date(review.time * 1000).toISOString(), // Unix timestamp → ISO
      }))
    : [];

  return {
    name: place.name,
    address: place.formatted_address,
    phone: place.formatted_phone_number,
    openingHours: place.opening_hours?.weekday_text || [],
    parking,
    rating: place.rating,
    website: place.website,
    nearbyTransit,
    reviews, // 리뷰 추가
    menus: [], // 메뉴는 사용자가 입력
  };
}

/**
 * 주차 정보 추정 (실제 데이터 없을 시 기본값)
 */
function estimateParking(address: string): string {
  // 간단한 휴리스틱: 주소에 "빌딩", "타워", "몰" 등이 있으면 주차 가능 추정
  if (/빌딩|타워|몰|플라자/i.test(address)) {
    return '건물 내 주차 가능 (유료)';
  }
  return '주차 정보 확인 필요';
}

/**
 * 대중교통 정보 생성 (간단한 형태)
 */
function generateTransitInfo(address: string): string {
  // 실제로는 Google Directions API를 사용해야 하지만, 여기서는 단순화
  const match = address.match(/([\w가-힣]+구|[\w가-힣]+동)/);
  if (match) {
    return `${match[1]} 인근 (대중교통 이용 권장)`;
  }
  return '대중교통 정보 확인 필요';
}
