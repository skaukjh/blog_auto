import { supabaseServer } from "@/lib/supabase/client";

const TABLE_NAME = "blog_styles";

/**
 * Supabase에 블로그 스타일을 저장합니다.
 * @param style 블로그 스타일 내용
 * @param userId 사용자 ID (기본값: "default")
 * @returns 성공 여부
 */
export async function saveBlogStyleToSupabase(
  style: string,
  userId: string = "default"
): Promise<boolean> {
  try {
    if (!supabaseServer) {
      console.warn("⚠️ Supabase가 설정되지 않았습니다. 로컬 저장으로 진행합니다.");
      return false;
    }

    const now = new Date().toISOString();

    // 기존 스타일 확인
    const { data: existing } = await supabaseServer
      .from(TABLE_NAME)
      .select("id")
      .eq("user_id", userId)
      .single();

    if (existing) {
      // UPDATE: 기존 레코드 업데이트
      const { error } = await supabaseServer
        .from(TABLE_NAME)
        .update({
          style_content: style,
          analyzed_at: now,
          updated_at: now,
        })
        .eq("id", existing.id);

      if (error) {
        console.error("❌ Supabase 스타일 업데이트 실패:", error);
        return false;
      }

      console.log("✅ Supabase 스타일 업데이트 완료");
      return true;
    } else {
      // INSERT: 새로운 레코드 생성
      const { error } = await supabaseServer
        .from(TABLE_NAME)
        .insert({
          user_id: userId,
          style_content: style,
          analyzed_at: now,
          created_at: now,
          updated_at: now,
        });

      if (error) {
        console.error("❌ Supabase 스타일 저장 실패:", error);
        return false;
      }

      console.log("✅ Supabase 스타일 저장 완료");
      return true;
    }
  } catch (error) {
    console.error("❌ Supabase 스타일 저장 중 오류:", error);
    return false;
  }
}

/**
 * Supabase에서 블로그 스타일을 로드합니다.
 * @param userId 사용자 ID (기본값: "default")
 * @returns 블로그 스타일 또는 null
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
        // 레코드가 없음 (정상)
        console.log("ℹ️ 저장된 블로그 스타일이 없습니다");
        return null;
      }
      console.error("❌ Supabase 스타일 조회 실패:", error);
      return null;
    }

    if (!data) {
      return null;
    }

    console.log("✅ Supabase에서 스타일 로드 완료");
    return {
      style: data.style_content,
      analyzedAt: data.analyzed_at,
    };
  } catch (error) {
    console.error("❌ Supabase 스타일 로드 중 오류:", error);
    return null;
  }
}

/**
 * Supabase에서 블로그 스타일을 삭제합니다.
 * @param userId 사용자 ID (기본값: "default")
 * @returns 성공 여부
 */
export async function deleteBlogStyleFromSupabase(
  userId: string = "default"
): Promise<boolean> {
  try {
    if (!supabaseServer) {
      console.warn("⚠️ Supabase가 설정되지 않았습니다");
      return false;
    }

    const { error } = await supabaseServer
      .from(TABLE_NAME)
      .delete()
      .eq("user_id", userId);

    if (error) {
      console.error("❌ Supabase 스타일 삭제 실패:", error);
      return false;
    }

    console.log("✅ Supabase 스타일 삭제 완료");
    return true;
  } catch (error) {
    console.error("❌ Supabase 스타일 삭제 중 오류:", error);
    return false;
  }
}
