import { supabaseServer } from "@/lib/supabase/client";

const TABLE_NAME = "blog_styles";

/**
 * 블로그 스타일 읽기 (읽기 전용)
 *
 * 스타일 분석/저장은 글 생성 앱(A)이 담당하고, 자동화(B)는 읽기만 합니다.
 * A와 같은 Supabase 프로젝트를 가리켜야 댓글 문체가 블로그와 일치합니다.
 */
export async function getBlogStyleFromSupabase(
  userId: string = "default"
): Promise<{ style: string; analyzedAt: string } | null> {
  try {
    if (!supabaseServer) {
      console.warn("⚠️ Supabase가 설정되지 않았습니다");
      return null;
    }

    const { data, error } = await supabaseServer
      .from(TABLE_NAME)
      .select("style_content, analyzed_at")
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        console.log(
          "ℹ️ 저장된 블로그 스타일이 없습니다. 글 생성 앱의 /format 에서 먼저 분석하세요."
        );
        return null;
      }
      console.error("❌ Supabase 스타일 조회 실패:", error);
      return null;
    }

    if (!data) return null;

    console.log("✅ Supabase에서 블로그 스타일 로드 완료");
    return { style: data.style_content, analyzedAt: data.analyzed_at };
  } catch (error) {
    console.error("❌ 블로그 스타일 조회 중 오류:", error);
    return null;
  }
}
