/**
 * 블로그 스타일 메모리 캐시
 *
 * 📌 용도:
 * - 서버 메모리에 블로그 스타일 임시 저장 (빠른 조회)
 * - Supabase 저장 실패 시 fallback
 * - 단일 프로세스 내에서 빠른 조회 (DB 접근 없음)
 *
 * 🔄 동작:
 * 1. 분석 결과 받으면 메모리에 저장
 * 2. Supabase에도 저장 시도 (실패해도 메모리에는 있음)
 * 3. 조회 시 메모리에서 즉시 반환
 * 4. 24시간 후 만료 (Supabase에서 재로드)
 */

interface CachedBlogStyle {
  style: string;
  timestamp: number; // 저장 시간
  expiresAt: number; // 만료 시간
}

class BlogStyleMemoryCache {
  private cache: CachedBlogStyle | null = null;
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24시간

  /**
   * 스타일을 메모리에 저장
   */
  set(style: string): void {
    const now = Date.now();
    this.cache = {
      style,
      timestamp: now,
      expiresAt: now + this.CACHE_DURATION,
    };
    console.log("✅ 블로그 스타일 메모리 캐시 저장됨");
    console.log(`   만료 시간: ${new Date(this.cache.expiresAt).toLocaleString()}`);
  }

  /**
   * 메모리에서 스타일 조회
   */
  get(): string | null {
    if (!this.cache) {
      console.log("⚠️ 저장된 스타일이 없습니다");
      return null;
    }

    // 만료 확인
    if (Date.now() > this.cache.expiresAt) {
      console.log("⚠️ 스타일이 만료되었습니다 (24시간 초과)");
      this.cache = null;
      return null;
    }

    console.log("✅ 메모리에서 스타일 로드됨");
    return this.cache.style;
  }

  /**
   * 캐시 상태 조회
   */
  getInfo() {
    if (!this.cache) {
      return {
        status: "empty",
        message: "저장된 스타일이 없습니다",
      };
    }

    const remainingTime = this.cache.expiresAt - Date.now();
    const remainingHours = Math.floor(remainingTime / (60 * 60 * 1000));

    return {
      status: "cached",
      message: `스타일이 메모리에 저장되어 있습니다`,
      expiresIn: `${remainingHours}시간 후`,
      timestamp: new Date(this.cache.timestamp).toLocaleString(),
    };
  }

  /**
   * 캐시 초기화
   */
  clear(): void {
    this.cache = null;
    console.log("🗑️ 블로그 스타일 캐시 초기화됨");
  }
}

// 싱글톤 인스턴스
const blogStyleCache = new BlogStyleMemoryCache();

export default blogStyleCache;

/**
 * 사용 예시:
 *
 * // 저장
 * blogStyleCache.set("분석된 스타일 텍스트");
 *
 * // 조회
 * const style = blogStyleCache.get();
 *
 * // 상태 확인
 * console.log(blogStyleCache.getInfo());
 *
 * // 초기화
 * blogStyleCache.clear();
 */
