import { openai, DEFAULT_MODEL } from "./client";
import { BLOG_STYLE_ANALYSIS_PROMPT } from "./prompts";
import type { BlogPost, BlogStyle } from "@/types/index";

/**
 * 블로그 글들을 분석하여 스타일을 추출합니다
 */
export async function analyzeBlogStyle(posts: BlogPost[]): Promise<BlogStyle> {
  try {
    if (posts.length === 0) {
      throw new Error("분석할 블로그 글이 없습니다");
    }

    // 글의 내용을 합쳐서 전송
    const postsContent = posts
      .map((post, index) => {
        return `글 ${index + 1}: ${post.title}\n내용:\n${post.excerpt}`;
      })
      .join("\n\n---\n\n");

    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        {
          role: "system",
          content: BLOG_STYLE_ANALYSIS_PROMPT,
        },
        {
          role: "user",
          content: postsContent,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error("스타일 분석 응답을 받을 수 없습니다");
    }

    // JSON 파싱
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("분석 결과를 파싱할 수 없습니다");
    }

    const style: BlogStyle = JSON.parse(jsonMatch[0]);

    // 필수 필드 확인
    const defaultStyle: BlogStyle = {
      tone: style.tone || "friendly",
      structure: style.structure || "intro → body → conclusion",
      emoticons: style.emoticons || [],
      keywords: style.keywords || [],
      sentenceLength: style.sentenceLength || "medium",
      commonPhrases: style.commonPhrases || [],
      callToAction: style.callToAction || "댓글과 공감 부탁드립니다",
      introduction: style.introduction || "안녕하세요!",
    };

    return defaultStyle;
  } catch (error) {
    console.error("블로그 스타일 분석 오류:", error);
    throw error;
  }
}

/**
 * 간략한 영문 스타일을 생성합니다 (더 상세하고 정확한 분석)
 * GPT-4o를 사용하여 더 높은 품질의 분석 제공
 */
export async function analyzeStyleCompact(posts: BlogPost[]): Promise<string> {
  try {
    if (posts.length < 2) {
      throw new Error("최소 2개의 글이 필요합니다");
    }

    // 글 내용 준비 (전체 내용 사용 - 더 정확한 분석)
    const postsContent = posts
      .slice(0, 2)
      .map((post, index) => {
        return `Post ${index + 1}: ${post.title}\nContent:\n${post.excerpt}`;
      })
      .join("\n\n---\n\n");

    const prompt = `You are a professional writing style analyzer. Analyze these 2 blog posts and extract ONLY the GENERAL writing style guide - the HOW, not the WHAT.

${postsContent}

CRITICAL INSTRUCTION: This analysis is for a restaurant food blog. Extract ONLY generic writing techniques that apply to ANY topic, NOT food-specific content.

Create a style guide in PLAIN TEXT covering:

1. SENTENCE ENDING PATTERN (MOST IMPORTANT):
   - Identify the primary sentence ending style (종결어미)
   - Look at how sentences end: ~~요, ~~다, ~~해요, ~~하다, etc.
   - Analyze at least 10 sentences to identify consistent pattern
   - State clearly: "Primary ending style: uses ~~요 endings" OR "Primary ending style: uses ~~다 endings"
   - Include 2-3 example patterns if mixed but with clear primary
   - THIS IS THE MOST CRITICAL ASPECT - place it FIRST

2. TONE & VOICE:
   - Overall tone (casual, professional, warm, friendly, educational)
   - Emotional expression method
   - Reader engagement approach

3. WRITING PATTERN:
   - Sentence length (short/medium/long)
   - Sentence structure (simple/complex/varied)
   - Paragraph size and organization

4. GENERIC EXPRESSIONS & CONNECTORS:
   - Recommendation phrases (make them GENERIC, e.g., "highly recommend" not "must try this dish")
   - Transition phrases between ideas
   - Satisfaction expressions (GENERIC only: "great experience" not "delicious food")
   - Approval phrases (GENERIC: "wonderful" not "amazing pasta")
   - DO NOT mention: 등갈비, 고기, 메뉴, 음식, 요리, 맛있어, 맛 - replace with generic equivalents

5. NARRATIVE STRUCTURE:
   - Opening style
   - Flow from start to end
   - Closing/CTA style

6. EMPHASIS TECHNIQUES:
   - How emphasis is created (repetition, exclamation, etc.)
   - Descriptive language style
   - Punctuation patterns

7. READER INTERACTION:
   - Question types
   - Recommendation format
   - Call-to-action patterns

OVERRIDE RULE - ALWAYS FORCE ~~요 ENDINGS:
- Regardless of what the sample posts use (~~다, ~~해, etc.)
- ALWAYS convert and describe the ending pattern as "uses ~~요 endings"
- Examples: 맛있어요, 좋았어요, 추천해요, 방문해보세요, 느꼈어요
- This is a MANDATORY requirement from the user
- DO NOT preserve ~~다 or any other ending style from samples

ABSOLUTE RULES - FOLLOW STRICTLY:
- REMOVE any food names, dish names, ingredient names, product names from the output
- REMOVE location names or venue-specific details
- Replace food descriptions with generic quality adjectives only
- NO emojis, NO quotation marks, NO special characters
- Use only: comma, hyphen, period, colon, parenthesis
- Focus on writing TECHNIQUE, not content or topic
- MOST IMPORTANT: Clearly identify and state the sentence ending pattern (종결어미) in section 1
- Maximum 500 tokens

Output: Plain text, numbered sections only. Start with SENTENCE ENDING PATTERN section.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert writing style analyzer. Extract detailed, accurate, and actionable style guides based on sample content. Focus on patterns, tone, structure, and conventions. Output should be practical for guiding AI-generated content.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.4,
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error("스타일 분석 응답을 받을 수 없습니다");
    }

    return content;
  } catch (error) {
    console.error("상세 스타일 분석 오류:", error);
    throw error;
  }
}

/**
 * 스타일 분석 비용을 추정합니다
 */
export function estimateBlogAnalysisCost(contentLength: number): number {
  // 입력 토큰: 약 4글자 = 1토큰
  // 출력 토큰: 약 1500 토큰 예상 (더 상세한 분석)
  const inputTokens = Math.ceil(contentLength / 4);
  const outputTokens = 1500;

  // gpt-4o 가격: 입력 $0.005/1K, 출력 $0.015/1K (2024-11 기준)
  const cost = (inputTokens / 1000) * 0.005 + (outputTokens / 1000) * 0.015;

  return Math.round(cost * 10000); // 센트 단위로 반환
}
