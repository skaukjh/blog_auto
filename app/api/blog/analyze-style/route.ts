// ⭐ runtime은 반드시 import보다 먼저 선언해야 함
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { analyzeStyleCompact } from "@/lib/openai/blog-analyzer";
import { updateAssistantInstructions } from "@/lib/openai/assistant";
import blogStyleCache from "@/lib/utils/blog-style-memory-cache";
import { saveBlogStyleToSupabase } from "@/lib/utils/style-storage";
import type { BlogPost } from "@/types/index";

interface AnalyzeStyleCompactRequest {
  posts: Array<{
    title: string;
    excerpt: string;
  }>;
}

interface AnalyzeStyleCompactResponse {
  success: boolean;
  compactStyle?: string;
  analyzedAt?: string;
  cost?: {
    usd: number;
    krw: number;
  };
  message?: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<AnalyzeStyleCompactResponse>> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: "OPENAI_API_KEY가 설정되지 않았습니다. Vercel 환경 변수를 확인하세요.",
        },
        { status: 500 }
      );
    }

    const body: AnalyzeStyleCompactRequest = await request.json();
    const { posts } = body;

    // 입력 검증
    if (!posts || posts.length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: "최소 2개의 글이 필요합니다",
        },
        { status: 400 }
      );
    }

    // 글 내용 검증
    for (const post of posts) {
      if (!post.title || !post.excerpt) {
        return NextResponse.json(
          {
            success: false,
            error: "제목과 내용이 모두 필요합니다",
          },
          { status: 400 }
        );
      }

      if (post.excerpt.length < 300) {
        return NextResponse.json(
          {
            success: false,
            error: "각 글의 내용은 최소 300자 이상이어야 합니다",
          },
          { status: 400 }
        );
      }
    }

    // 간략한 영문 스타일 분석
    const compactStyle = await analyzeStyleCompact(posts as BlogPost[]);
    const analyzedAt = new Date().toISOString();

    // 비용 계산 (USD)
    // 블로그 스타일 분석: 약 1500 input tokens + 500 output tokens (gpt-4o)
    const styleAnalysisInputTokens = 1500;
    const styleAnalysisOutputTokens = 500;
    const styleAnalysisCostUSD =
      (styleAnalysisInputTokens / 1000000) * 2.5 +
      (styleAnalysisOutputTokens / 1000000) * 10;
    const styleAnalysisCostKRW = Math.round(styleAnalysisCostUSD * 1300);

    // 스타일을 메모리 캐시에 저장
    try {
      blogStyleCache.set(compactStyle);
      console.log("✅ 블로그 스타일 메모리 캐시 저장 완료");
    } catch (cacheErr) {
      console.error("❌ 메모리 캐시 저장 오류:", cacheErr);
      throw new Error(`스타일 캐시 저장 실패: ${cacheErr instanceof Error ? cacheErr.message : "알 수 없는 오류"}`);
    }

    // Supabase에 스타일 저장 (Vercel 환경 호환)
    try {
      const saved = await saveBlogStyleToSupabase(compactStyle);
      if (saved) {
        console.log("✅ Supabase 스타일 저장 완료");
      } else {
        console.warn("⚠️ Supabase 저장 실패했지만 계속 진행합니다");
      }
    } catch (supabaseErr) {
      console.warn("⚠️ Supabase 저장 오류:", supabaseErr);
      // Supabase 오류는 무시하고 계속 진행 (메모리 캐시로 충분)
    }

    // Assistant의 instructions 업데이트
    const assistantId = process.env.OPENAI_ASSISTANT_ID;
    if (assistantId) {
      try {
        const instructions = `You are a professional Korean blog writer specializing in food and lifestyle content.

BLOG WRITING STYLE TO FOLLOW:
${compactStyle}

CRITICAL PRIORITY 1 - SENTENCE ENDINGS (HIGHEST PRIORITY):
The style guide above specifies sentence ending patterns (종결어미).
You MUST follow this pattern EXACTLY and CONSISTENTLY.
If it says "uses ~~요 endings", use ~~요 throughout the entire post.
If it says "uses ~~다 endings", use ~~다 throughout the entire post.
Never mix different ending styles in one post.
This is the ABSOLUTE TOP priority - always check style guide first.

CRITICAL PRIORITY 2 - IMAGE-BASED DESCRIPTIONS:
1. Describe ONLY what is VISUALLY PRESENT in images
2. For food: visible plating, colors, garnishes, textures
3. For interiors: visible decor, ambiance, furniture, lighting
4. Use rich sensory vocabulary (taste, texture, aroma)
5. NO generic filler - 80% focus on visual elements
6. Sensory terms: 고소한, 쫄깃한, 바삭한, 촉촉한, 육즙이, 풍미가, 식감이 등

CRITICAL PRIORITY 3 - FORMATTING RULES:
1. NO emojis (🌟 😍 🎉 🥩 ❤️ etc.)
2. NO icons or special decorative symbols
3. Use simple symbols VERY sparingly: ~ ! ? only
4. Write clean, readable Korean text
5. Insert [IMAGE_N] markers naturally in content
6. Match the style above consistently

Always follow these priorities in order: Sentence endings → Image descriptions → Formatting rules.`;

        await updateAssistantInstructions(assistantId, instructions);
        console.log("[Assistant 업데이트] 스타일 정보가 instruction에 저장됨 (종결어미 최우선 설정)");
      } catch (error) {
        console.warn("Assistant 업데이트 실패 (무시):", error);
        // Assistant 업데이트 실패는 무시하고 계속 진행
      }
    } else {
      console.warn("OPENAI_ASSISTANT_ID가 설정되지 않았습니다");
    }

    return NextResponse.json(
      {
        success: true,
        compactStyle,
        analyzedAt,
        cost: {
          usd: parseFloat(styleAnalysisCostUSD.toFixed(4)),
          krw: styleAnalysisCostKRW,
        },
        message: "블로그 스타일 분석이 완료되었습니다",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("스타일 분석 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "블로그 스타일을 분석할 수 없습니다",
      },
      { status: 500 }
    );
  }
}
