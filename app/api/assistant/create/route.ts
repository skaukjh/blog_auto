import { NextResponse } from "next/server";
import { createAssistant } from "@/lib/openai/assistant";
import { CONTENT_GENERATOR_SYSTEM_PROMPT } from "@/lib/openai/prompts";
import type { AssistantCreateResponse } from "@/types/index";

export async function POST(): Promise<NextResponse<AssistantCreateResponse | { success: false; error: string }>> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: "OPENAI_API_KEY가 설정되지 않았습니다. Vercel 환경 변수를 확인하세요." },
        { status: 500 }
      );
    }

    const assistantId = await createAssistant(
      CONTENT_GENERATOR_SYSTEM_PROMPT,
      "Blog Content Generator"
    );

    // .env.local에 저장할 값을 반환 (클라이언트에서 직접 저장해야 함)
    // 또는 서버에서 처리하려면 별도 구성 필요
    return NextResponse.json(
      {
        id: assistantId,
        object: "assistant",
        created_at: Math.floor(Date.now() / 1000),
        model: "gpt-4o",
        instructions: CONTENT_GENERATOR_SYSTEM_PROMPT,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Assistant 생성 오류:", error);
    return NextResponse.json(
      { success: false, error: "Assistant를 생성할 수 없습니다" },
      { status: 500 }
    );
  }
}
