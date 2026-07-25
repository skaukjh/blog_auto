import OpenAI from "openai";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

/**
 * 사용 가능한 OpenAI 모델
 *
 * ⚠️ 여기에 실존하지 않는 모델명을 넣지 마세요.
 * 추가 전 `GET https://api.openai.com/v1/models` 로 확인해야 합니다.
 * (과거 gpt-5.2 / claude-opus-4-6 / gemini-3-pro 등 가짜 모델명이 들어가
 *  선택 시 400 오류가 나던 이력이 있습니다.)
 */
export const OPENAI_MODELS = {
  // 프론티어 - 전부 비전 입력 지원. temperature/max_tokens 미지원
  GPT_5_6_SOL: "gpt-5.6-sol",     // 최고 성능 (복잡한 추론)
  GPT_5_6_TERRA: "gpt-5.6-terra", // 성능/비용 균형
  GPT_5_6_LUNA: "gpt-5.6-luna",   // 비용 우선

  // 레거시 - temperature 조절이 필요한 경우에만
  GPT_4O: "gpt-4o",
  GPT_4O_MINI: "gpt-4o-mini",
} as const;

export type OpenAIModelId = (typeof OPENAI_MODELS)[keyof typeof OPENAI_MODELS];

// 비용 절감(2026-07-24 사용자 요청): 최고 성능 sol 대신 균형 모델 terra를 기본으로 씁니다.
// sol이 필요하면 UI의 모델 선택에서 개별 지정할 수 있습니다.

/**
 * 이미지 분석 기본 모델
 *
 * 2026-07-25 추가 절감(글당 100원 목표): terra → luna.
 * 이미지 분석은 "보이는 것을 적는" 작업이라 본문 생성보다 추론 부담이 작고,
 * 단가는 terra의 40%입니다(입력 $1 vs $2.5, 출력 $6 vs $15).
 * 묘사가 얕게 느껴지면 UI 모델 설정에서 이 단계만 terra로 올릴 수 있습니다.
 */
export const IMAGE_ANALYSIS_MODEL: OpenAIModelId = OPENAI_MODELS.GPT_5_6_LUNA;

/** 콘텐츠 생성 기본 모델 */
export const CONTENT_MODEL: OpenAIModelId = OPENAI_MODELS.GPT_5_6_TERRA;

/** 보조 작업(팩트 추출·추천 등) 기본 모델 */
export const UTILITY_MODEL: OpenAIModelId = OPENAI_MODELS.GPT_5_6_TERRA;

export const DEFAULT_MODEL: OpenAIModelId = CONTENT_MODEL;

/**
 * GPT-5 이상 계열 여부.
 * 이 계열은 `max_tokens` 대신 `max_completion_tokens`를 쓰고,
 * `temperature`는 기본값(1) 외의 값을 거부합니다.
 */
export function isNextGenModel(model: string): boolean {
  return /^(gpt-5|o[1-9])/.test(model);
}

/** 해당 모델이 temperature 조절을 지원하는지 */
export function supportsTemperature(model: string): boolean {
  return !isNextGenModel(model);
}

/** 모델 ID가 우리가 지원하는 값인지 확인 */
export function isValidModel(modelName: string): modelName is OpenAIModelId {
  return (Object.values(OPENAI_MODELS) as string[]).includes(modelName);
}

/** 유효하지 않으면 fallback을 반환 */
export function resolveModel(
  modelName: string | undefined,
  fallback: OpenAIModelId
): OpenAIModelId {
  if (modelName && isValidModel(modelName)) return modelName;
  if (modelName) {
    console.warn(`⚠️ 지원하지 않는 모델 "${modelName}" → "${fallback}"로 대체합니다`);
  }
  return fallback;
}

/**
 * 모델 계열에 맞는 요청 파라미터를 만듭니다.
 *
 * 호출부에서 매번 분기하지 않도록 여기서 한 번에 처리합니다.
 * - GPT-5 이상: max_completion_tokens 사용, temperature 제거
 * - 그 외: max_tokens + temperature 그대로 사용
 */
export function buildChatParams(options: {
  model: string;
  messages: ChatCompletionCreateParamsNonStreaming["messages"];
  maxTokens: number;
  temperature?: number;
}): ChatCompletionCreateParamsNonStreaming {
  const { model, messages, maxTokens, temperature } = options;

  if (isNextGenModel(model)) {
    return { model, messages, max_completion_tokens: maxTokens };
  }

  return {
    model,
    messages,
    max_tokens: maxTokens,
    ...(temperature !== undefined ? { temperature } : {}),
  };
}
