import type { StyleScope } from "@/types/index";

/**
 * 블로그 문체 메모리 캐시 (전문가별)
 *
 * 용도:
 * - 서버 메모리에 전문가별 문체를 임시 보관해 Supabase 왕복을 줄입니다
 * - Supabase 저장이 실패해도 그 프로세스가 사는 동안은 동작하도록 하는 fallback
 *
 * 동작:
 * 1. 분석 결과를 scope(전문가) 단위로 저장
 * 2. Supabase에도 저장 시도 (실패해도 메모리에는 남음)
 * 3. 조회 시 메모리에서 즉시 반환, 없으면 호출부가 Supabase로 폴백
 * 4. 24시간 후 만료
 *
 * ⚠️ 서버리스에서는 인스턴스마다 캐시가 따로 존재하고 언제든 사라집니다.
 *    영속성의 근거는 어디까지나 Supabase이며 이 캐시는 가속 장치일 뿐입니다.
 */

interface CachedBlogStyle {
  style: string;
  sampleCount: number;
  timestamp: number;
  expiresAt: number;
}

const FALLBACK_SCOPE: StyleScope = "common";

class BlogStyleMemoryCache {
  private cache = new Map<StyleScope, CachedBlogStyle>();
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24시간

  /** 문체를 메모리에 저장 */
  set(style: string, scope: StyleScope = FALLBACK_SCOPE, sampleCount: number = 0): void {
    const now = Date.now();
    this.cache.set(scope, {
      style,
      sampleCount,
      timestamp: now,
      expiresAt: now + this.CACHE_DURATION,
    });
    console.log(`✅ 문체 메모리 캐시 저장됨 (${scope})`);
  }

  /**
   * 메모리에서 문체 조회.
   * 해당 전문가 것이 없으면 'common'으로 폴백합니다.
   */
  get(scope: StyleScope = FALLBACK_SCOPE): string | null {
    const exact = this.readFresh(scope);
    if (exact) return exact.style;

    if (scope !== FALLBACK_SCOPE) {
      const fallback = this.readFresh(FALLBACK_SCOPE);
      if (fallback) return fallback.style;
    }
    return null;
  }

  /** 폴백 없이 해당 scope만 조회 */
  getExact(scope: StyleScope): string | null {
    return this.readFresh(scope)?.style ?? null;
  }

  /** 만료 검사를 포함한 실제 읽기 */
  private readFresh(scope: StyleScope): CachedBlogStyle | null {
    const entry = this.cache.get(scope);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(scope);
      console.log(`⚠️ 문체 캐시 만료됨 (${scope})`);
      return null;
    }
    return entry;
  }

  /** 캐시 상태 조회 (UI 표시용) */
  getInfo(scope: StyleScope = FALLBACK_SCOPE) {
    const entry = this.readFresh(scope);
    if (!entry) {
      return { status: "empty" as const, message: "저장된 문체가 없습니다" };
    }

    const remainingHours = Math.floor((entry.expiresAt - Date.now()) / (60 * 60 * 1000));
    return {
      status: "cached" as const,
      message: "문체가 메모리에 저장되어 있습니다",
      sampleCount: entry.sampleCount,
      expiresIn: `${remainingHours}시간 후`,
      timestamp: new Date(entry.timestamp).toLocaleString(),
    };
  }

  /** 캐시가 살아있는 scope 목록 */
  cachedScopes(): StyleScope[] {
    return [...this.cache.keys()].filter((scope) => this.readFresh(scope) !== null);
  }

  /** 특정 scope 또는 전체 초기화 */
  clear(scope?: StyleScope): void {
    if (scope) {
      this.cache.delete(scope);
      console.log(`🗑️ 문체 캐시 초기화됨 (${scope})`);
    } else {
      this.cache.clear();
      console.log("🗑️ 문체 캐시 전체 초기화됨");
    }
  }
}

// 싱글톤 인스턴스
const blogStyleCache = new BlogStyleMemoryCache();

export default blogStyleCache;
