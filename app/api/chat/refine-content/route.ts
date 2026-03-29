import { NextRequest, NextResponse } from "next/server";
import { openai, DEFAULT_MODEL } from "@/lib/openai/client";
import type {
  RefineContentRequest,
  RefineContentResponse,
} from "@/types/index";

export async function POST(
  request: NextRequest
): Promise<NextResponse<RefineContentResponse>> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          refinedContent: "",
          error: "OPENAI_API_KEY가 설정되지 않았습니다. Vercel 환경 변수를 확인하세요.",
        },
        { status: 500 }
      );
    }

    const body: RefineContentRequest = await request.json();
    const { conversationHistory, userRequest, currentContent, imageAnalysis } =
      body;

    // 검증
    if (!userRequest || !currentContent) {
      return NextResponse.json(
        {
          success: false,
          refinedContent: "",
          error: "요청이 올바르지 않습니다",
        },
        { status: 400 }
      );
    }

    // 시스템 프롬프트
    const systemPrompt = `You are helping refine a Korean blog post based on user feedback. You are a professional power blogger specializing in food and lifestyle content.

CRITICAL RULES:
1. ALL sentences MUST end with ~~요 pattern (해요체)
2. ONLY use ! and ~ punctuation - NEVER use ?
3. Make MINIMAL changes - only what the user requested
4. Maintain the overall structure and image markers [IMAGE_N]
5. Keep other parts of the content EXACTLY as they were
6. Focus on the specific part the user mentioned
7. Preserve the natural, warm tone - write like chatting with a friend

Current content length: ${currentContent.length} characters
Image markers: ${imageAnalysis.images.length} total (must preserve all)
Total images must match the number of [IMAGE_N] markers.`;

    // 대화 히스토리 구성
    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Current blog post:\n\n${currentContent}\n\nPlease make the following modification: ${userRequest}`,
      },
      ...conversationHistory.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
    ];

    // OpenAI 호출
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages,
      temperature: 0.3, // 낮은 온도로 일관성 유지
      max_tokens: 3000,
    });

    const refinedContent = response.choices[0]?.message?.content || "";

    if (!refinedContent) {
      throw new Error("수정된 콘텐츠를 받을 수 없습니다");
    }

    return NextResponse.json(
      {
        success: true,
        refinedContent,
        message: "콘텐츠가 수정되었습니다",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("콘텐츠 수정 오류:", error);
    return NextResponse.json(
      {
        success: false,
        refinedContent: "",
        error:
          error instanceof Error ? error.message : "콘텐츠를 수정할 수 없습니다",
      },
      { status: 500 }
    );
  }
}
