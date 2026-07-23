import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

/**
 * Phase 20: 다중 AI 모델 지원
 * OpenAI, Claude, Gemini 등 다양한 모델 지원
 */
export const OPENAI_MODELS = {
  // OpenAI Models
  GPT_5_2: "gpt-5.2",
  GPT_4_5: "gpt-4.5",
  GPT_4_1: "gpt-4-turbo",
  GPT_4O: "gpt-4o",
  GPT_4O_MINI: "gpt-4o-mini",
  O3: "o3",
  O3_MINI: "o3-mini",
  O4_MINI: "o4-mini",

  // Claude Models (프록시를 통해 사용 가능)
  CLAUDE_OPUS_4_6: "claude-opus-4-6",
  CLAUDE_OPUS_4_5: "claude-opus-4-5",
  CLAUDE_SONNET_4_5: "claude-sonnet-4-5",
  CLAUDE_HAIKU_4_5: "claude-haiku-4-5",

  // Gemini Models (프록시를 통해 사용 가능)
  GEMINI_3_PRO: "gemini-3-pro",
  GEMINI_3_FLASH: "gemini-3-flash",
};

export const DEFAULT_MODEL = OPENAI_MODELS.GPT_4O;

/**
 * 모델 이름이 유효한지 확인
 */
export function isValidModel(modelName: string): boolean {
  // OpenAI 모델들
  if (
    modelName === 'gpt-5.2' ||
    modelName === 'gpt-4.5' ||
    modelName === 'gpt-4o' ||
    modelName === 'gpt-4o-mini' ||
    modelName === 'gpt-4-turbo' ||
    modelName.startsWith('o3') ||
    modelName.startsWith('o4')
  ) {
    return true;
  }

  // Claude 모델들 (프록시 사용 시)
  if (modelName.includes('claude')) {
    return true;
  }

  // Gemini 모델들 (프록시 사용 시)
  if (modelName.includes('gemini')) {
    return true;
  }

  // 기타 모델들
  if (modelName.includes('grok') || modelName.includes('deepseek')) {
    return true;
  }

  return false;
}
