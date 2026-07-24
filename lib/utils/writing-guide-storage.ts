import { supabaseServer } from "@/lib/supabase/client";

const TABLE_NAME = "writing_guides";

/** 글쓰기 가이드는 자주 바뀌지 않으므로 24시간 캐시합니다 */
const CACHE_DURATION = 24 * 60 * 60 * 1000;

export interface StoredWritingGuide {
  guide: string;
  sources: string[];
  analyzedAt: string;
  /**
   * 이 값('요'|'다')이 있으면 학습된 전문가 문체를 무시하고 모든 글을 이 어미로 강제합니다.
   * null이면 학습 문체의 종결어미를 따릅니다. (사용자 결정 2026-07-24)
   */
  endingPattern: "요" | "다" | null;
}

/**
 * 프로세스 메모리 캐시.
 *
 * 서버리스에서는 인스턴스마다 따로 존재하지만, 같은 인스턴스가 연속 요청을
 * 처리하는 동안 Supabase 왕복을 줄여줍니다. blog-style-memory-cache 와 같은 방식입니다.
 */
let cache: { value: StoredWritingGuide | null; at: number } | null = null;

/**
 * 저장된 글쓰기 가이드를 읽습니다.
 *
 * 가이드는 `scripts/analyze-writing-guide.mjs` 가 로컬에서 한 번 만들어
 * Supabase에 넣어 둡니다. 글 생성 때는 읽기만 하고 재분석하지 않습니다.
 *
 * 가이드가 없으면 null이며, 그 경우 글 생성은 실패하지 않고 가이드 없이 진행됩니다.
 */
export async function getWritingGuide(
  userId: string = "default"
): Promise<StoredWritingGuide | null> {
  if (cache && Date.now() - cache.at < CACHE_DURATION) {
    return cache.value;
  }

  if (!supabaseServer) {
    console.warn("⚠️ Supabase가 설정되지 않아 글쓰기 가이드를 읽을 수 없습니다");
    return null;
  }

  try {
    // ending_pattern 컬럼이 없을 수도(마이그레이션 006 미적용) 있어 실패 시 빼고 재조회합니다.
    const withEnding = "guide_content, sources, analyzed_at, ending_pattern";
    const withoutEnding = "guide_content, sources, analyzed_at";

    const first = await supabaseServer
      .from(TABLE_NAME)
      .select(withEnding)
      .eq("user_id", userId)
      .maybeSingle();

    let data = first.data as Record<string, unknown> | null;
    let error = first.error;

    if (error && (error.code === "42703" || /ending_pattern/.test(error.message ?? ""))) {
      const retry = await supabaseServer
        .from(TABLE_NAME)
        .select(withoutEnding)
        .eq("user_id", userId)
        .maybeSingle();
      data = retry.data as Record<string, unknown> | null;
      error = retry.error;
    }

    if (error) {
      // 마이그레이션 005 미적용 시 테이블이 없습니다. 오류가 아니라 정상 상태로 봅니다.
      if (error.code === "42P01") {
        console.log("ℹ️ writing_guides 테이블이 없습니다 (마이그레이션 005 미적용)");
      } else {
        console.error("❌ 글쓰기 가이드 조회 실패:", error);
      }
      cache = { value: null, at: Date.now() };
      return null;
    }

    if (!data?.guide_content) {
      cache = { value: null, at: Date.now() };
      return null;
    }

    const rawEnding = data.ending_pattern;
    const value: StoredWritingGuide = {
      guide: data.guide_content as string,
      sources: Array.isArray(data.sources) ? (data.sources as string[]) : [],
      analyzedAt: data.analyzed_at as string,
      endingPattern: rawEnding === "요" || rawEnding === "다" ? rawEnding : null,
    };

    cache = { value, at: Date.now() };
    console.log(`✅ 글쓰기 가이드 로드 완료 (자료 ${value.sources.length}건)`);
    return value;
  } catch (error) {
    console.error("❌ 글쓰기 가이드 조회 중 오류:", error);
    return null;
  }
}

/** 캐시를 비웁니다 (가이드를 새로 분석한 직후 등) */
export function clearWritingGuideCache(): void {
  cache = null;
}
