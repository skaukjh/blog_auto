import OpenAI from 'openai';
import { WebSearchResult } from '@/types';

/**
 * Phase 20: 팩트 추출
 * 웹 검색 결과에서 할루시네이션 방지
 */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface FactExtractionResult {
  query: string;
  facts: string[];
  rawSummary: string;
  confidence: number;
}

/**
 * 웹 검색 결과에서 주요 팩트 추출
 * hallucination을 방지하기 위해 검색 결과에 기반한 정보만 추출
 */
export async function extractFacts(
  query: string,
  searchResults: WebSearchResult[],
  model: string = 'gpt-4o-mini'
): Promise<FactExtractionResult> {
  try {
    const searchSummary = searchResults
      .map((result, idx) => `[결과 ${idx + 1}]\n제목: ${result.title}\n내용: ${result.snippet}`)
      .join('\n\n');

    const prompt = `당신은 웹 검색 결과에서 정확한 팩트만 추출하는 전문가입니다.

사용자 쿼리: "${query}"

웹 검색 결과:
${searchSummary}

작업: 위 검색 결과에 기반하여 정확한 팩트만 추출하세요.

CRITICAL RULES:
1. 검색 결과에 명시적으로 있는 정보만 포함
2. 추론이나 가정은 절대 금지
3. 수치, 이름, 날짜는 정확하게
4. "알 수 없습니다" 또는 "검색 결과에 없습니다" 표시

Output Format:
<facts>
- 팩트1
- 팩트2
- 팩트3
</facts>

<confidence>
추출 신뢰도 (0-100)
</confidence>`;

    const response = await openai.chat.completions.create({
      model: model,
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.choices[0]?.message?.content || '';

    // XML 파싱
    const factsMatch = content.match(/<facts>([\s\S]*?)<\/facts>/);
    const confidenceMatch = content.match(/<confidence>([\s\S]*?)<\/confidence>/);

    const factsText = factsMatch ? factsMatch[1].trim() : '';
    const confidenceText = confidenceMatch ? confidenceMatch[1].trim() : '0';

    const facts = factsText
      .split('\n')
      .filter((line) => line.startsWith('-'))
      .map((line) => line.substring(1).trim())
      .filter((fact) => fact.length > 0);

    const confidence = parseInt(confidenceText, 10) || 0;

    return {
      query,
      facts,
      rawSummary: searchSummary,
      confidence,
    };
  } catch (error) {
    console.error('Fact extraction error:', error);
    throw error;
  }
}

/**
 * 팩트를 콘텐츠 생성 프롬프트에 통합
 */
export function formatFactsForPrompt(facts: FactExtractionResult): string {
  if (facts.facts.length === 0) {
    return '웹 검색에서 구체적인 정보를 찾을 수 없습니다.';
  }

  return `
웹 검색에서 확인된 정보 (신뢰도: ${facts.confidence}%):
${facts.facts.map((fact) => `- ${fact}`).join('\n')}

참고: 위 정보를 자연스럽게 콘텐츠에 통합하세요. 검색에 없는 내용은 추가하지 마세요.
  `.trim();
}
