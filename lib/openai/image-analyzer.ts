import { openai, IMAGE_ANALYSIS_MODEL, resolveModel, buildChatParams } from "./client";
import { getExpertPrompt } from "@/lib/experts/prompts";
import { extractUsage, sumUsage } from "./pricing";
import type {
  ImageAnalysisResult,
  CompressedImageAnalysis,
  ExpertType,
  ModelConfig,
  OverallAnalysis,
  TokenUsage,
} from "@/types/index";

export async function analyzeImagesExpert(
  images: string[],
  topic: string,
  expertType: ExpertType,
  modelConfig: ModelConfig
): Promise<ImageAnalysisResult> {
  try {
    const expertPrompt = getExpertPrompt(expertType);
    const model = modelConfig.imageAnalysisModel;

    // 배치 분석 (전문가 프롬프트 사용).
    //
    // 배치 응답에는 개별 이미지 분석과 함께 전체 테마(overall)가 들어 있습니다.
    // 과거에는 이 overall을 버리고 이미지 3장을 다시 보내 별도로 한 번 더
    // 분석했습니다(2026-07-25 제거). 같은 이미지를 두 번 업로드하는 셈이라
    // 입력 토큰이 그만큼 더 들었고, 얻는 정보는 거의 같았습니다.
    const { analyses, overall, usage } = await analyzeImageBatchExpert(
      images,
      topic,
      expertPrompt.imageAnalysisSystemPrompt,
      model,
      1
    );

    return {
      images: analyses,
      overall: overall ?? {
        theme: topic,
        style: "visual",
        suggestions: ["이미지를 자연스럽게 배치하세요"],
      },
      // 실제 사용량 기반 비용(USD). 추정치가 아닙니다.
      costEstimate: usage.usd,
      usage,
    };
  } catch (error) {
    console.error("전문가 이미지 분석 오류:", error);
    throw error;
  }
}

interface BatchAnalysisResult {
  analyses: CompressedImageAnalysis[];
  /** 첫 배치가 판단한 전체 테마 (없으면 null) */
  overall: OverallAnalysis | null;
  usage: TokenUsage;
}

/**
 * 전문가 기반 배치 분석 (내부 함수)
 */
async function analyzeImageBatchExpert(
  images: string[],
  topic: string,
  systemPrompt: string,
  model: string,
  _startIndex: number = 1,
  batchSize: number = 5
): Promise<BatchAnalysisResult> {
  const allAnalyses: CompressedImageAnalysis[] = [];
  const usageParts: TokenUsage[] = [];
  let overall: OverallAnalysis | null = null;

  // 배치로 나누기
  for (let i = 0; i < images.length; i += batchSize) {
    const batch = images.slice(i, Math.min(i + batchSize, images.length));
    const result = await analyzeImageBatchInternalExpert(batch, topic, systemPrompt, model, i + 1);
    allAnalyses.push(...result.analyses);
    usageParts.push(result.usage);

    // 전체 테마는 첫 배치의 판단을 씁니다 (사진 순서상 앞쪽이 글의 주제에 가깝습니다).
    if (!overall && result.overall) {
      overall = result.overall;
    }
  }

  const modelName = resolveModel(model, IMAGE_ANALYSIS_MODEL);

  return {
    analyses: allAnalyses,
    overall,
    usage: sumUsage(modelName, usageParts),
  };
}

/**
 * 전문가 기반 배치 분석 내부 함수
 */
async function analyzeImageBatchInternalExpert(
  images: string[],
  topic: string,
  systemPrompt: string,
  model: string,
  startIndex: number = 1
): Promise<BatchAnalysisResult> {
  try {
    const messageContent = [
      {
        type: "text" as const,
        text: `You MUST respond with ONLY valid JSON. No markdown, no code blocks, no extra text.

These images will be used for a blog post titled: "${topic}"

Analyze each image and provide analysis starting from image index ${startIndex}.
Also fill in "overall" with the shared theme, visual style, and how to use these
images in that blog post.

Return ONLY this JSON structure:
{
  "images": [
    {
      "idx": number,
      "cats": [{"category": "string", "confidence": number, "details": "string"}],
      "desc": "description",
      "mood": "mood",
      "visualDetails": "detailed visual characteristics"
    }
  ],
  "overall": {
    "theme": "theme",
    "style": "style",
    "suggestions": ["suggestion1", "suggestion2"]
  }
}`,
      },
      ...images.map((image) => ({
        type: "image_url" as const,
        image_url: {
          url: image,
          detail: "high" as const,
        },
      })),
    ];

    const modelName = resolveModel(model, IMAGE_ANALYSIS_MODEL);

    const response = await openai.chat.completions.create(
      buildChatParams({
        model: modelName,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: messageContent as any,
          },
        ],
        temperature: 0.2,
        maxTokens: 8000,
      })
    );

    let content = response.choices[0]?.message?.content || "";

    if (!content) {
      throw new Error("이미지 분석 응답을 받을 수 없습니다");
    }

    // 마크다운 코드 블록 제거
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    // JSON 파싱
    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch (e) {
      const startIdx = content.indexOf("{");
      if (startIdx === -1) {
        throw new Error("분석 결과를 찾을 수 없습니다");
      }

      const endIdx = content.lastIndexOf("}");
      if (endIdx === -1 || endIdx <= startIdx) {
        throw new Error("분석 결과를 찾을 수 없습니다");
      }

      const jsonStr = content.substring(startIdx, endIdx + 1);
      analysis = JSON.parse(jsonStr);
    }

    if (!analysis || !analysis.images || !Array.isArray(analysis.images)) {
      throw new Error("분석 결과 구조가 유효하지 않습니다");
    }

    const imageAnalyses: CompressedImageAnalysis[] = analysis.images || [];
    const overall: OverallAnalysis | null =
      analysis.overall && typeof analysis.overall.theme === "string"
        ? {
            theme: analysis.overall.theme,
            style: analysis.overall.style ?? "visual",
            suggestions: Array.isArray(analysis.overall.suggestions)
              ? analysis.overall.suggestions
              : [],
          }
        : null;

    return {
      // 인덱스 조정
      analyses: imageAnalyses.map((img, idx) => ({
        ...img,
        idx: startIndex + idx,
      })),
      overall,
      usage: extractUsage(modelName, response.usage),
    };
  } catch (error) {
    console.error("전문가 이미지 배치 분석 오류:", error);
    throw error;
  }
}
