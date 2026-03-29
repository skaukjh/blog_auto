/**
 * 모델별 가격 정보 및 비용 계산
 * Phase 22: 비용 계산 통합
 */

/**
 * 모델별 가격 정보 (USD per 1M tokens)
 * 2025년 2월 기준
 */
export const MODEL_PRICING = {
  // OpenAI
  'gpt-5.2': { input: 5, output: 15, name: 'GPT-5.2' },
  'gpt-4.5': { input: 3, output: 9, name: 'GPT-4.5' },
  'gpt-4.1': { input: 3, output: 9, name: 'GPT-4.1' },
  'gpt-4o': { input: 2.5, output: 10, name: 'GPT-4o' },
  'gpt-4o-mini': { input: 0.15, output: 0.6, name: 'GPT-4o Mini' },

  // Claude (Anthropic)
  'claude-opus-4.6': { input: 15, output: 75, name: 'Claude Opus 4.6' },
  'claude-sonnet-4.5': { input: 3, output: 15, name: 'Claude Sonnet 4.5' },
  'claude-haiku-4.5': { input: 0.8, output: 4, name: 'Claude Haiku 4.5' },

  // Gemini (Google)
  'gemini-3-pro': { input: 1.25, output: 5, name: 'Gemini 3 Pro' },
  'gemini-3-flash': { input: 0.075, output: 0.3, name: 'Gemini 3 Flash' },
} as const;

export type ModelKey = keyof typeof MODEL_PRICING;

/**
 * 환율 (KRW per USD)
 */
export const EXCHANGE_RATE = 1300;

/**
 * 비용 계산
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): {
  usd: number;
  krw: number;
  inputCost: number;
  outputCost: number;
} {
  const pricing = MODEL_PRICING[model as ModelKey];

  if (!pricing) {
    console.warn(`Unknown model: ${model}`);
    return { usd: 0, krw: 0, inputCost: 0, outputCost: 0 };
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  const totalUsd = inputCost + outputCost;
  const totalKrw = Math.round(totalUsd * EXCHANGE_RATE);

  return {
    usd: parseFloat(totalUsd.toFixed(4)),
    krw: totalKrw,
    inputCost: parseFloat(inputCost.toFixed(4)),
    outputCost: parseFloat(outputCost.toFixed(4)),
  };
}

/**
 * 이미지 분석 비용 추정 (vision 토큰)
 */
export function estimateImageAnalysisCost(
  model: string,
  imageCount: number,
  detail: 'low' | 'high' = 'high'
): {
  estimatedTokens: number;
  estimatedCost: { usd: number; krw: number };
} {
  // 이미지당 예상 토큰 (detail: 'low' = 85, detail: 'high' = 170+)
  const tokensPerImage = detail === 'low' ? 85 : 170;
  const estimatedInputTokens = imageCount * tokensPerImage;

  // 응답 예상 토큰 (약 200)
  const estimatedOutputTokens = 200;

  const cost = calculateCost(model, estimatedInputTokens, estimatedOutputTokens);

  return {
    estimatedTokens: estimatedInputTokens + estimatedOutputTokens,
    estimatedCost: { usd: cost.usd, krw: cost.krw },
  };
}

/**
 * 콘텐츠 생성 비용 추정
 */
export function estimateContentGenerationCost(
  model: string,
  inputTokens: number = 2000, // 평균 input
  outputTokens: number = 3000 // 블로그 글 평균 output
): {
  estimatedCost: { usd: number; krw: number };
} {
  const cost = calculateCost(model, inputTokens, outputTokens);

  return {
    estimatedCost: { usd: cost.usd, krw: cost.krw },
  };
}

/**
 * 모델별 용도별 추천
 */
export const MODEL_RECOMMENDATIONS = {
  imageAnalysis: {
    best: 'gpt-4o' as const,
    budget: 'gpt-4o-mini' as const,
    description: '고품질 이미지 분석이 필요하면 gpt-4o 추천',
  },
  contentGeneration: {
    best: 'gpt-4o' as const,
    budget: 'gpt-4o-mini' as const,
    description: '자연스러운 콘텐츠 생성이 필요하면 gpt-4o 추천',
  },
  factExtraction: {
    best: 'gpt-4o-mini' as const,
    budget: 'gpt-4o-mini' as const,
    description: '팩트 추출은 gpt-4o-mini로 충분',
  },
} as const;

/**
 * 일일 비용 추정 (10회 요청 기준)
 */
export function estimateDailyCost(
  model: string,
  requestsPerDay: number = 10
): {
  perRequest: { usd: number; krw: number };
  daily: { usd: number; krw: number };
  monthly: { usd: number; krw: number };
} {
  // 이미지 분석 (10개 이미지) + 콘텐츠 생성
  const imageAnalysisCost = estimateImageAnalysisCost(model, 10, 'high');
  const contentGenCost = estimateContentGenerationCost(model);

  const perRequestUsd = imageAnalysisCost.estimatedCost.usd + contentGenCost.estimatedCost.usd;
  const perRequestKrw = imageAnalysisCost.estimatedCost.krw + contentGenCost.estimatedCost.krw;

  const dailyUsd = perRequestUsd * requestsPerDay;
  const dailyKrw = perRequestKrw * requestsPerDay;

  const monthlyUsd = dailyUsd * 30;
  const monthlyKrw = dailyKrw * 30;

  return {
    perRequest: {
      usd: parseFloat(perRequestUsd.toFixed(4)),
      krw: Math.round(perRequestKrw),
    },
    daily: {
      usd: parseFloat(dailyUsd.toFixed(4)),
      krw: Math.round(dailyKrw),
    },
    monthly: {
      usd: parseFloat(monthlyUsd.toFixed(2)),
      krw: Math.round(monthlyKrw),
    },
  };
}

/**
 * 모델 이름 포맷팅
 */
export function formatModelName(model: string): string {
  const pricing = MODEL_PRICING[model as ModelKey];
  return pricing ? pricing.name : model;
}
