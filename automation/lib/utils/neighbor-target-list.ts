import { supabaseServer } from "@/lib/supabase/client";

const TABLE_NAME = "neighbor_target_list";

/**
 * Supabase에서 대상 닉네임 목록을 조회합니다.
 * @param userId 사용자 ID (기본값: "default")
 * @returns 닉네임 배열 또는 null
 */
export async function getNeighborTargetList(
  userId: string = "default"
): Promise<string[] | null> {
  try {
    if (!supabaseServer) {
      console.warn("⚠️ Supabase가 설정되지 않았습니다");
      return null;
    }

    const { data, error } = await supabaseServer
      .from(TABLE_NAME)
      .select("nicknames")
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // 레코드가 없음 (정상)
        console.log("ℹ️ 저장된 대상 닉네임 목록이 없습니다");
        return null;
      }
      console.error("❌ Supabase 목록 조회 실패:", error);
      return null;
    }

    if (!data || !data.nicknames) {
      return null;
    }

    console.log(`✅ Supabase에서 대상 목록 로드 완료 (${data.nicknames.length}개)`);
    return data.nicknames;
  } catch (error) {
    console.error("❌ 대상 닉네임 목록 조회 중 오류:", error);
    return null;
  }
}

/**
 * Supabase에 대상 닉네임 목록을 저장합니다.
 * @param nicknames 닉네임 배열
 * @param userId 사용자 ID (기본값: "default")
 * @returns 성공 여부
 */
export async function saveNeighborTargetList(
  nicknames: string[],
  userId: string = "default"
): Promise<boolean> {
  try {
    if (!supabaseServer) {
      console.warn("⚠️ Supabase가 설정되지 않았습니다");
      return false;
    }

    const now = new Date().toISOString();

    // 기존 데이터 확인
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
          nicknames,
          updated_at: now,
        })
        .eq("id", existing.id);

      if (error) {
        console.error("❌ Supabase 목록 업데이트 실패:", error);
        return false;
      }

      console.log(`✅ Supabase 목록 업데이트 완료 (${nicknames.length}개)`);
      return true;
    } else {
      // INSERT: 새로운 레코드 생성
      const { error } = await supabaseServer.from(TABLE_NAME).insert({
        user_id: userId,
        nicknames,
        created_at: now,
        updated_at: now,
      });

      if (error) {
        console.error("❌ Supabase 목록 저장 실패:", error);
        return false;
      }

      console.log(`✅ Supabase 목록 저장 완료 (${nicknames.length}개)`);
      return true;
    }
  } catch (error) {
    console.error("❌ 대상 닉네임 목록 저장 중 오류:", error);
    return false;
  }
}

/**
 * 닉네임을 목록에 추가합니다.
 * @param nickname 추가할 닉네임
 * @param userId 사용자 ID (기본값: "default")
 * @returns 성공 여부
 */
export async function addNeighborTarget(
  nickname: string,
  userId: string = "default"
): Promise<boolean> {
  try {
    const currentList = await getNeighborTargetList(userId);
    const newList = currentList || [];

    // 중복 확인
    if (newList.includes(nickname)) {
      console.warn(`⚠️ 이미 존재하는 닉네임입니다: ${nickname}`);
      return false;
    }

    newList.push(nickname);
    return await saveNeighborTargetList(newList, userId);
  } catch (error) {
    console.error("❌ 닉네임 추가 중 오류:", error);
    return false;
  }
}

/**
 * 닉네임을 목록에서 제거합니다.
 * @param nickname 제거할 닉네임
 * @param userId 사용자 ID (기본값: "default")
 * @returns 성공 여부
 */
export async function removeNeighborTarget(
  nickname: string,
  userId: string = "default"
): Promise<boolean> {
  try {
    const currentList = await getNeighborTargetList(userId);

    if (!currentList || !currentList.includes(nickname)) {
      console.warn(`⚠️ 해당 닉네임을 찾을 수 없습니다: ${nickname}`);
      return false;
    }

    const newList = currentList.filter((n) => n !== nickname);
    return await saveNeighborTargetList(newList, userId);
  } catch (error) {
    console.error("❌ 닉네임 제거 중 오류:", error);
    return false;
  }
}
