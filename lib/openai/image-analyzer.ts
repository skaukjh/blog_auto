import { openai, OPENAI_MODELS } from "./client";
import { IMAGE_ANALYSIS_PROMPT } from "./prompts";
import { getExpertPrompt } from "@/lib/experts/prompts";
import type { ImageAnalysisResult, CompressedImageAnalysis, ExpertType, ModelConfig } from "@/types/index";

export async function analyzeImagesExpert(
  images: string[],
  topic: string,
  expertType: ExpertType,
  modelConfig: ModelConfig
): Promise<ImageAnalysisResult> {
  try {
    const expertPrompt = getExpertPrompt(expertType);
    const model = modelConfig.imageAnalysisModel as keyof typeof OPENAI_MODELS;

    // 배치 분석 (전문가 프롬프트 사용)
    const imageAnalyses = await analyzeImageBatchExpert(
      images,
      expertPrompt.imageAnalysisSystemPrompt,
      model,
      1
    );

    // 통합 컨텍스트 분석
    const overall = await analyzeOverallContextExpert(
      images,
      topic,
      expertPrompt.imageAnalysisSystemPrompt,
      model
    );

    // 토큰 비용 추정 (모델별로 다름)
    const tokensPerImage = modelConfig.imageAnalysisModel.includes('gpt-4') ? 170 : 150;
    const baseTokens = images.length * tokensPerImage;
    const promptTokens = 500;
    const outputTokens = 800;
    const totalTokens = baseTokens + promptTokens + outputTokens;

    // 모델별 가격 추정 (대략값)
    let cost = 0;
    if (modelConfig.imageAnalysisModel.includes('gpt-4')) {
      cost = (totalTokens / 1000000) * 2.5 + (outputTokens / 1000000) * 10;
    } else if (modelConfig.imageAnalysisModel.includes('claude')) {
      cost = (totalTokens / 1000000) * 15 + (outputTokens / 1000000) * 75; // Claude Opus 가격
    } else if (modelConfig.imageAnalysisModel.includes('gemini')) {
      cost = (totalTokens / 1000000) * 1.25 + (outputTokens / 1000000) * 5; // Gemini Pro 가격
    }

    return {
      images: imageAnalyses,
      overall,
      costEstimate: Math.round(cost * 10000), // 센트 단위로 반환
    };
  } catch (error) {
    console.error("전문가 이미지 분석 오류:", error);
    throw error;
  }
}

/**
 * 전문가 기반 배치 분석 (내부 함수)
 */
async function analyzeImageBatchExpert(
  images: string[],
  systemPrompt: string,
  model: keyof typeof OPENAI_MODELS,
  _startIndex: number = 1,
  batchSize: number = 5
): Promise<CompressedImageAnalysis[]> {
  const allAnalyses: CompressedImageAnalysis[] = [];

  // 배치로 나누기
  for (let i = 0; i < images.length; i += batchSize) {
    const batch = images.slice(i, Math.min(i + batchSize, images.length));
    const batchAnalyses = await analyzeImageBatchInternalExpert(batch, systemPrompt, model, i + 1);
    allAnalyses.push(...batchAnalyses);
  }

  return allAnalyses;
}

/**
 * 전문가 기반 배치 분석 내부 함수
 */
async function analyzeImageBatchInternalExpert(
  images: string[],
  systemPrompt: string,
  model: keyof typeof OPENAI_MODELS,
  startIndex: number = 1
): Promise<CompressedImageAnalysis[]> {
  try {
    const messageContent = [
      {
        type: "text" as const,
        text: `You MUST respond with ONLY valid JSON. No markdown, no code blocks, no extra text.

Analyze each image and provide analysis starting from image index ${startIndex}.

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

    const modelKey = (model || 'GPT_4O') as keyof typeof OPENAI_MODELS;
    const modelName = OPENAI_MODELS[modelKey] || 'gpt-4o';

    const response = await openai.chat.completions.create({
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
      max_tokens: 2000,
    });

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

    // 인덱스 조정
    return imageAnalyses.map((img, idx) => ({
      ...img,
      idx: startIndex + idx,
    }));
  } catch (error) {
    console.error("전문가 이미지 배치 분석 오류:", error);
    throw error;
  }
}

/**
 * 전문가 기반 통합 컨텍스트 분석
 */
async function analyzeOverallContextExpert(
  images: string[],
  topic: string,
  systemPrompt: string,
  model: keyof typeof OPENAI_MODELS
): Promise<{ theme: string; style: string; suggestions: string[] }> {
  try {
    const messageContent = [
      {
        type: "text" as const,
        text: `These images will be used for a blog post about: "${topic}"\n\nProvide overall analysis in JSON format:\n{\n  "theme": "overall visual theme",\n  "style": "visual style",\n  "suggestions": ["how to use in blog"]\n}`,
      },
      ...images.slice(0, 3).map((image) => ({
        type: "image_url" as const,
        image_url: {
          url: image,
          detail: "high" as const,
        },
      })),
    ];

    const modelKey = (model || 'GPT_4O') as keyof typeof OPENAI_MODELS;
    const modelName = OPENAI_MODELS[modelKey] || 'gpt-4o';

    const response = await openai.chat.completions.create({
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
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      return {
        theme: topic,
        style: "visual",
        suggestions: ["이미지를 자연스럽게 배치하세요"],
      };
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        theme: topic,
        style: "visual",
        suggestions: ["이미지를 자연스럽게 배치하세요"],
      };
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("전문가 종합 컨텍스트 분석 오류:", error);
    return {
      theme: topic,
      style: "visual",
      suggestions: ["이미지를 자연스럽게 배치하세요"],
    };
  }
}
