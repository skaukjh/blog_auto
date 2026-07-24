import { supabaseServer } from "@/lib/supabase/client";

const TABLE_NAME = "blog_styles";

/** 전문가 지정 없이 분석한 문체 */
const FALLBACK_SCOPE = "common";

/**
 * 블로그 문체 읽기 (읽기 전용)
 *
 * 문체 분석/저장은 글 생성 앱(A)이 담당하고, 자동화(B)는 읽기만 합니다.
 * A와 같은 Supabase 프로젝트를 가리켜야 댓글 문체가 블로그와 일치합니다.
 *
 * ⚠️ A는 전문가(맛집/제품/여행/리빙)별로 문체를 따로 저장하므로
 *    user_id 하나에 여러 행이 존재할 수 있습니다. 댓글은 전문가 구분이
 *    없으므로 다음 순서로 하나를 고릅니다.
 *      1) scope 인자로 지정된 전문가
 *      2) 'common' (전문가 미지정 문체)
 *      3) 가장 최근에 분석된 아무 문체
 *
 * @param scope 선호하는 전문가 문체 (예: 'restaurant'). 없으면 common → 최신 순
 */
export async function getBlogStyleFromSupabase(
  scope?: string,
  userId: string = "default"
): Promise<{ style: string; analyzedAt: string; scope: string } | null> {
  try {
    if (!supabaseServer) {
      console.warn("⚠️ Supabase가 설정되지 않았습니다");
      return null;
    }

    // 이 사용자의 문체를 최신순으로 모두 가져온 뒤 코드에서 고릅니다.
    // (행이 여러 개일 수 있어 .single() 을 쓰면 오류가 납니다)
    const { data, error } = await supabaseServer
      .from(TABLE_NAME)
      .select("expert_id, style_content, analyzed_at")
      .eq("user_id", userId)
      .order("analyzed_at", { ascending: false });

    if (error) {
      console.error("❌ Supabase 문체 조회 실패:", error);
      return null;
    }

    if (!data || data.length === 0) {
      console.log(
        "ℹ️ 저장된 블로그 문체가 없습니다. 글 생성 앱의 /format 에서 먼저 분석하세요."
      );
      return null;
    }

    const picked =
      (scope ? data.find((row) => row.expert_id === scope) : undefined) ??
      data.find((row) => row.expert_id === FALLBACK_SCOPE) ??
      data[0];

    console.log(`✅ Supabase에서 블로그 문체 로드 완료 (${picked.expert_id})`);
    return {
      style: picked.style_content,
      analyzedAt: picked.analyzed_at,
      scope: picked.expert_id,
    };
  } catch (error) {
    console.error("❌ 블로그 문체 조회 중 오류:", error);
    return null;
  }
}
