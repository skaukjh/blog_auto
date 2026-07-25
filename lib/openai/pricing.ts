/**
 * 모델 단가표와 실제 사용량 기반 비용 계산
 *
 * ⚠️ 과거에는 각 API 라우트가 `inputTokens = 2000` 같은 하드코딩 값으로 비용을
 * 추정했습니다. 그래서 화면에 뜨는 금액이 실제 청구액과 무관했고, "글당 얼마"를
 * 판단할 근거가 되지 못했습니다. 이제는 응답의 `usage`를 그대로 받아 계산합니다.
 *
 * 단가는 1M 토큰 기준 공식가입니다. 모델을 추가할 때는 단가도 함께 등록하세요.
 * 등록되지 않은 모델은 terra 단가로 계산하고 경고를 남깁니다.
 */

import type { TokenUsage } from '@/types/index';

/** 1 USD → KRW (기존 화면 표기와 동일한 환율을 유지합니다) */
export const USD_TO_KRW = 1300;

interface ModelPrice {
  /** 입력 1M 토큰당 USD */
  input: number;
  /** 출력 1M 토큰당 USD */
  output: number;
}

/** 1M 토큰당 공식 단가 */
export const MODEL_PRICING: Record<string, ModelPrice> = {
  'gpt-5.6-sol': { input: 5, output: 30 },
  'gpt-5.6-terra': { input: 2.5, output: 15 },
  'gpt-5.6-luna': { input: 1, output: 6 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
};

const FALLBACK_PRICE = MODEL_PRICING['gpt-5.6-terra'];

/** 모델 단가를 찾습니다. 등록되지 않은 모델은 terra 단가로 추정합니다. */
export function priceFor(model: string): ModelPrice {
  const price = MODEL_PRICING[model];
  if (price) return price;

  console.warn(`⚠️ 단가가 등록되지 않은 모델 "${model}" → terra 단가로 추정합니다`);
  return FALLBACK_PRICE;
}

/** 토큰 수와 모델로 비용(USD)을 계산합니다. */
export function calcUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = priceFor(model);
  return (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
}

/**
 * OpenAI 응답에서 실제 사용량을 뽑아 비용까지 계산합니다.
 *
 * `usage`가 없는 응답도 있으므로 그 경우 0으로 둡니다. 0이면 화면에서
 * "실측 아님"으로 구분할 수 있습니다.
 */
export function extractUsage(
  model: string,
  usage: { prompt_tokens?: number; completion_tokens?: number } | undefined
): TokenUsage {
  const inputTokens = usage?.prompt_tokens ?? 0;
  const outputTokens = usage?.completion_tokens ?? 0;

  return {
    model,
    inputTokens,
    outputTokens,
    usd: calcUsd(model, inputTokens, outputTokens),
  };
}

/** 여러 호출의 사용량을 하나로 합칩니다 (모델이 다르면 비용만 합산). */
export function sumUsage(model: string, parts: TokenUsage[]): TokenUsage {
  return parts.reduce<TokenUsage>(
    (acc, part) => ({
      model,
      inputTokens: acc.inputTokens + part.inputTokens,
      outputTokens: acc.outputTokens + part.outputTokens,
      usd: acc.usd + part.usd,
    }),
    { model, inputTokens: 0, outputTokens: 0, usd: 0 }
  );
}

/** USD를 원화(정수)로 변환합니다. */
export function toKrw(usd: number): number {
  return Math.round(usd * USD_TO_KRW);
}
