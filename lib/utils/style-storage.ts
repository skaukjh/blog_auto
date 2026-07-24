import { supabaseServer } from "@/lib/supabase/client";
import type { StyleScope, StoredBlogStyle } from "@/types/index";

const TABLE_NAME = "blog_styles";

/** 전문가별 문체가 없을 때 폴백으로 쓰는 scope */
export const FALLBACK_SCOPE: StyleScope = "common";

/**
 * 전문가별 블로그 문체를 저장합니다.
 *
 * (user_id, expert_id) 복합 UNIQUE 제약을 기준으로 upsert 하므로,
 * 같은 전문가를 다시 분석하면 기존 문체를 덮어씁니다.
 *
 * @param style 분석된 스타일 가이드 본문
 * @param scope 전문가 구분 (restaurant/product/travel/living 또는 common)
 * @param sampleCount 분석에 사용한 예시글 수
 * @param samplesHash 분석에 사용한 예시글의 지문. 다음 요청에서 재분석 여부 판단에 씁니다
 * @param samples 분석에 사용한 예시글 원문. /format 재방문 시 입력창 복원에 씁니다
 * @param userId 사용자 ID (기본값: "default")
 * @returns 실제로 DB에 저장됐는지 여부
 */
export async function saveBlogStyleToSupabase(
  style: string,
  scope: StyleScope = FALLBACK_SCOPE,
  sampleCount: number = 0,
  samplesHash: string | null = null,
  samples: string[] | null = null,
  userId: string = "default"
): Promise<boolean> {
  if (!supabaseServer) {
    console.warn("⚠️ Supabase가 설정되지 않았습니다. 메모리 캐시로만 진행합니다.");
    return false;
  }

  try {
    const now = new Date().toISOString();

    const base = {
      user_id: userId,
      expert_id: scope,
      style_content: style,
      analyzed_at: now,
      sample_count: sampleCount,
      updated_at: now,
    };

    // 복합 UNIQUE 제약 덕분에 조회 없이 한 번의 upsert로 처리됩니다.
    const { error } = await supabaseServer.from(TABLE_NAME).upsert(
      { ...base, samples_hash: samplesHash, samples },
      { onConflict: "user_id,expert_id" }
    );

    if (error) {
      // 마이그레이션 004가 아직 적용되지 않아 samples_hash/samples 컬럼이 없는 경우.
      // 문체 저장 자체를 실패시키지 않고 해당 컬럼만 빼고 다시 시도합니다.
      // (재분석 건너뛰기·예시글 복원만 동작하지 않고 나머지는 그대로 돌아갑니다)
      const isMissingColumn =
        error.code === "42703" ||
        error.code === "PGRST204" ||
        /samples_hash|samples/.test(error.message ?? "");

      if (isMissingColumn) {
        console.warn(
          `⚠️ samples_hash/samples 컬럼이 없습니다. 마이그레이션 004를 적용하세요. 이번 저장은 해당 값 없이 진행합니다.`
        );
        const retry = await supabaseServer
          .from(TABLE_NAME)
          .upsert(base, { onConflict: "user_id,expert_id" });

        if (retry.error) {
          console.error(`❌ Supabase 문체 저장 실패 (${scope}):`, retry.error);
          return false;
        }

        console.log(`✅ Supabase 문체 저장 완료 (${scope}, 예시글 ${sampleCount}개, 지문 없음)`);
        return true;
      }

      console.error(`❌ Supabase 문체 저장 실패 (${scope}):`, error);
      return false;
    }

    console.log(`✅ Supabase 문체 저장 완료 (${scope}, 예시글 ${sampleCount}개)`);
    return true;
  } catch (error) {
    console.error(`❌ Supabase 문체 저장 중 오류 (${scope}):`, error);
    return false;
  }
}

/**
 * 저장된 문체와 그때 쓴 예시글 지문을 함께 조회합니다.
 *
 * 지문이 요청과 같으면 OpenAI 재분석을 건너뛰기 위한 용도입니다.
 * 마이그레이션 004 이전에 저장된 행은 `samplesHash`가 null이며,
 * 그 경우 항상 재분석합니다.
 */
export async function getStyleWithHash(
  scope: StyleScope,
  userId: string = "default"
): Promise<{ style: string; analyzedAt: string; sampleCount: number; samplesHash: string | null } | null> {
  if (!supabaseServer) return null;

  try {
    const { data, error } = await supabaseServer
      .from(TABLE_NAME)
      .select("style_content, analyzed_at, sample_count, samples_hash")
      .eq("user_id", userId)
      .eq("expert_id", scope)
      .maybeSingle();

    if (error) {
      console.error(`❌ 문체 지문 조회 실패 (${scope}):`, error);
      return null;
    }
    if (!data) return null;

    return {
      style: data.style_content,
      analyzedAt: data.analyzed_at,
      sampleCount: data.sample_count ?? 0,
      samplesHash: data.samples_hash ?? null,
    };
  } catch (error) {
    console.error(`❌ 문체 지문 조회 중 오류 (${scope}):`, error);
    return null;
  }
}

/**
 * 특정 scope의 문체를 조회합니다. 폴백하지 않습니다.
 */
export async function getBlogStyleForScope(
  scope: StyleScope,
  userId: string = "default"
): Promise<StoredBlogStyle | null> {
  if (!supabaseServer) {
    console.warn("⚠️ Supabase가 설정되지 않았습니다");
    return null;
  }

  try {
    const { data, error } = await supabaseServer
      .from(TABLE_NAME)
      .select("style_content, analyzed_at, sample_count")
      .eq("user_id", userId)
      .eq("expert_id", scope)
      .maybeSingle();

    if (error) {
      console.error(`❌ Supabase 문체 조회 실패 (${scope}):`, error);
      return null;
    }

    if (!data) return null;

    return {
      style: data.style_content,
      analyzedAt: data.analyzed_at,
      sampleCount: data.sample_count ?? 0,
      scope,
    };
  } catch (error) {
    console.error(`❌ Supabase 문체 조회 중 오류 (${scope}):`, error);
    return null;
  }
}

/**
 * 글 생성에 쓸 문체를 조회합니다.
 *
 * 우선순위: 요청한 전문가의 문체 → 'common' 문체 → null
 * 폴백이 일어나면 반환값의 `scope`가 요청값과 달라지므로 호출부에서 구분할 수 있습니다.
 */
export async function getBlogStyleFromSupabase(
  scope: StyleScope = FALLBACK_SCOPE,
  userId: string = "default"
): Promise<StoredBlogStyle | null> {
  const exact = await getBlogStyleForScope(scope, userId);
  if (exact) return exact;

  if (scope !== FALLBACK_SCOPE) {
    const fallback = await getBlogStyleForScope(FALLBACK_SCOPE, userId);
    if (fallback) {
      console.log(`ℹ️ ${scope} 문체가 없어 ${FALLBACK_SCOPE} 문체로 대체합니다`);
      return fallback;
    }
  }

  console.log(`ℹ️ 저장된 문체가 없습니다 (${scope})`);
  return null;
}

/**
 * 저장된 모든 scope의 문체를 한 번에 조회합니다. (/format 화면의 현황 표시용)
 */
export async function getAllBlogStyles(
  userId: string = "default"
): Promise<Record<string, StoredBlogStyle & { samples?: string[] }>> {
  if (!supabaseServer) return {};

  // 마이그레이션 004 이전에는 samples 컬럼이 없으므로, 실패하면 빼고 다시 조회합니다.
  const withSamples = "expert_id, style_content, analyzed_at, sample_count, samples";
  const withoutSamples = "expert_id, style_content, analyzed_at, sample_count";

  try {
    const first = await supabaseServer
      .from(TABLE_NAME)
      .select(withSamples)
      .eq("user_id", userId);

    let data: unknown[] | null = first.data;
    let error = first.error;

    if (error) {
      console.warn("ℹ️ samples 컬럼 없이 재조회합니다 (마이그레이션 004 미적용):", error.message);
      const retry = await supabaseServer
        .from(TABLE_NAME)
        .select(withoutSamples)
        .eq("user_id", userId);
      data = retry.data;
      error = retry.error;
    }

    if (error || !data) {
      if (error) console.error("❌ Supabase 문체 목록 조회 실패:", error);
      return {};
    }

    const result: Record<string, StoredBlogStyle & { samples?: string[] }> = {};
    for (const row of data as Array<Record<string, unknown>>) {
      const scope = row.expert_id as StyleScope;
      const samples = Array.isArray(row.samples) ? (row.samples as string[]) : undefined;

      result[scope] = {
        style: row.style_content as string,
        analyzedAt: row.analyzed_at as string,
        sampleCount: (row.sample_count as number) ?? 0,
        scope,
        ...(samples ? { samples } : {}),
      };
    }
    return result;
  } catch (error) {
    console.error("❌ Supabase 문체 목록 조회 중 오류:", error);
    return {};
  }
}

/**
 * 특정 scope의 문체를 삭제합니다.
 */
export async function deleteBlogStyleFromSupabase(
  scope: StyleScope = FALLBACK_SCOPE,
  userId: string = "default"
): Promise<boolean> {
  if (!supabaseServer) {
    console.warn("⚠️ Supabase가 설정되지 않았습니다");
    return false;
  }

  try {
    const { error } = await supabaseServer
      .from(TABLE_NAME)
      .delete()
      .eq("user_id", userId)
      .eq("expert_id", scope);

    if (error) {
      console.error(`❌ Supabase 문체 삭제 실패 (${scope}):`, error);
      return false;
    }

    console.log(`✅ Supabase 문체 삭제 완료 (${scope})`);
    return true;
  } catch (error) {
    console.error(`❌ Supabase 문체 삭제 중 오류 (${scope}):`, error);
    return false;
  }
}
