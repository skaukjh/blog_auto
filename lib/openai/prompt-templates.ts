/**
 * 공통 프롬프트 템플릿
 * Phase 21: 프롬프트 중복 제거
 * 모든 System Prompt에서 공통으로 사용되는 규칙 템플릿
 */

/**
 * 모든 콘텐츠 생성의 기본 규칙
 */
export const COMMON_PROMPT_RULES = {
  // 최우선: 종결어미 일관성
  sentenceEnding: `CRITICAL PRIORITY 1 - SENTENCE ENDING CONSISTENCY (HIGHEST IMPORTANCE):
- MANDATORY: ALL sentences MUST end with ~~요 pattern (해요체)
- 100% consistency required throughout the ENTIRE post
- Examples: "매우 좋아요", "강력 추천해요", "도움이 되었어요"
- DO NOT mix with other endings (다, 하다, 해)`,

  // 2순위: 이미지 기반 설명
  imageBasedDesc: `CRITICAL PRIORITY 2 - IMAGE-BASED DESCRIPTIONS (ESSENTIAL):
⚠️ MANDATORY: ONLY describe what is VISUALLY PRESENT in images
- 80% focus on image visual elements
- 20% context from search results or background knowledge
- NO generic filler unrelated to images
- Examples of GOOD: "밝은 노란색 스콘", "촉촉하고 부드러운 크레마"
- Examples of BAD: "맛있어요", "정말 좋아요", "강력 추천합니다"`,

  // 3순위: 마커 규칙
  markerRules: `CRITICAL PRIORITY 3 - IMAGE MARKER RULES (TECHNICAL):
- Use EXACTLY [IMAGE_1] through [IMAGE_N] format
- 1-based indexing (start from 1, NOT 0)
- Place markers at contextually relevant positions
- One marker per image, total markers = total images
- Marker placement MUST align with surrounding text context`,

  // 포맷팅 규칙
  formatting: `CRITICAL FORMATTING RULES:
1. NO emojis (🌟 😍 💕 etc.)
2. NO special icons (★ ♡ → etc.)
3. ALLOWED: ~ and ! only, use sparingly
4. Sentence length: 20-35 characters (Korean)
5. Paragraph length: 3-4 sentences
6. Line breaks: Natural, not excessive`,

  // 감각 어휘
  sensoryVocab: {
    taste: '고소한, 달콤한, 짭짜한, 담백한, 진한, 자극적인, 부드러운, 풍미로운, 상큼한, 신맛, 떫은맛',
    texture: '쫄깃한, 바삭한, 촉촉한, 폭신한, 말랑한, 딱딱한, 탄탄한, 부드러운, 뻣뻣한, 뭉실뭉실한',
    aroma: '은은한, 향긋한, 고소로운, 상큼한, 강렬한, 깊이 있는, 산뜻한, 구수한',
    visual: '선명한, 생생한, 화려한, 세련된, 자연스러운, 통통한, 윤기 나는, 거친, 매끈한',
    temperature: '따뜻한, 시원한, 차가운, 상큼한, 화끈한, 살살한, 사르르 녹는',
  },

  // 구체적 표현 패턴
  specificPatterns: `CONCRETE EXPRESSION PATTERNS:
- Temperature: "따뜻한", "시원한", "살살 녹는"
- Texture: "한 입 베어무니", "촉촉하게", "바삭바삭"
- Visual: "밝은", "선명한", "윤기 나는"
- Plating: "고르게 담긴", "중앙에 올려진", "돌판에 담긴"
- Quantity: "푸짐한", "적당한", "충만한"`,
};

/**
 * 공통 포맷팅 헬퍼
 */
export const FORMATTING_HELPERS = {
  /**
   * 공통 규칙을 조합하여 System Prompt 생성
   */
  createSystemPrompt(options: {
    role: string;
    expertise: string;
    additionalRules?: string;
  }): string {
    return `You are ${options.role}.
Your expertise: ${options.expertise}

${COMMON_PROMPT_RULES.sentenceEnding}

${COMMON_PROMPT_RULES.imageBasedDesc}

${COMMON_PROMPT_RULES.markerRules}

${COMMON_PROMPT_RULES.formatting}

SENSORY VOCABULARY:
- Taste: ${COMMON_PROMPT_RULES.sensoryVocab.taste}
- Texture: ${COMMON_PROMPT_RULES.sensoryVocab.texture}
- Aroma: ${COMMON_PROMPT_RULES.sensoryVocab.aroma}
- Visual: ${COMMON_PROMPT_RULES.sensoryVocab.visual}
- Temperature: ${COMMON_PROMPT_RULES.sensoryVocab.temperature}

${COMMON_PROMPT_RULES.specificPatterns}

${options.additionalRules || ''}`;
  },

  /**
   * User Prompt 생성
   */
  createUserPrompt(options: {
    context: string;
    task: string;
    constraints?: string;
  }): string {
    return `Context:
${options.context}

Task:
${options.task}

${options.constraints ? `Constraints:\n${options.constraints}` : ''}`;
  },
};
