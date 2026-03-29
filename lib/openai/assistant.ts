import { openai, OPENAI_MODELS } from "./client";

/**
 * Assistant를 생성합니다
 */
export async function createAssistant(
  instructions: string,
  name: string = "Blog Style Assistant"
): Promise<string> {
  try {
    const assistant = await openai.beta.assistants.create({
      model: OPENAI_MODELS.GPT_4O,
      name,
      instructions,
    });

    return assistant.id;
  } catch (error) {
    console.error("Assistant 생성 실패:", error);
    throw new Error("Assistant를 생성할 수 없습니다");
  }
}

/**
 * Assistant의 instructions를 업데이트합니다
 */
export async function updateAssistantInstructions(
  assistantId: string,
  instructions: string
): Promise<void> {
  try {
    await openai.beta.assistants.update(assistantId, {
      instructions,
    });
  } catch (error) {
    console.error("Assistant 업데이트 실패:", error);
    throw new Error("Assistant를 업데이트할 수 없습니다");
  }
}

/**
 * Assistant 정보를 조회합니다
 */
export async function getAssistantInfo(assistantId: string) {
  try {
    const assistant = await openai.beta.assistants.retrieve(assistantId);

    return {
      id: assistant.id,
      name: assistant.name,
      model: assistant.model,
      instructions: assistant.instructions,
      created_at: assistant.created_at,
    };
  } catch (error) {
    console.error("Assistant 조회 실패:", error);
    throw new Error("Assistant 정보를 조회할 수 없습니다");
  }
}

/**
 * Assistant를 삭제합니다
 */
export async function deleteAssistant(assistantId: string): Promise<void> {
  try {
    await openai.beta.assistants.del(assistantId);
  } catch (error) {
    console.error("Assistant 삭제 실패:", error);
    throw new Error("Assistant를 삭제할 수 없습니다");
  }
}
