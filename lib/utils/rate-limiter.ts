import { LRUCache } from 'lru-cache';

/**
 * 요청별 Rate Limiting을 위한 LRU 캐시
 * 분당 최대 요청 수를 제한하여 API 할당량 보호
 */

const rateLimitCache = new LRUCache<string, number>({
  max: 500, // 최대 500개의 IP 주소 추적
  ttl: 60 * 1000, // 1분 TTL
});

/**
 * IP 주소별 요청 수 확인 및 Rate Limiting 검사
 * @param ip 클라이언트 IP 주소
 * @param limit 분당 최대 요청 수 (기본값: 10)
 * @returns Rate limit 통과 여부
 */
export function checkRateLimit(ip: string, limit: number = 10): boolean {
  if (!ip) {
    return false;
  }

  const count = (rateLimitCache.get(ip) || 0) as number;

  if (count >= limit) {
    return false;
  }

  rateLimitCache.set(ip, count + 1);
  return true;
}

/**
 * 현재 IP의 요청 수 조회
 */
export function getRateLimitCount(ip: string): number {
  return (rateLimitCache.get(ip) || 0) as number;
}

/**
 * Rate limit 캐시 초기화 (테스트용)
 */
export function clearRateLimit(): void {
  rateLimitCache.clear();
}
