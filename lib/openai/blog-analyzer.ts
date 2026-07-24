import { openai, DEFAULT_MODEL, buildChatParams } from "./client";
import { BLOG_STYLE_ANALYSIS_PROMPT } from "./prompts";
import { EXPERTS } from "@/lib/experts/definitions";
import type { BlogPost, BlogStyle, StyleScope } from "@/types/index";

/**
 * 문체 분석에 필요한 최소 예시글 개수.
 *
 * 상한은 없습니다. 넣는 만큼 전부 분석에 들어갑니다.
 * 다만 예시글 전체가 한 번의 요청으로 모델에 들어가므로, 지나치게 많이 넣으면
 * 컨텍스트 한도에 걸려 OpenAI 쪽에서 오류가 날 수 있습니다.
 */
export const MIN_STYLE_SAMPLES = 2;

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

    const response = await openai.chat.completions.create(
      buildChatParams({
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
        maxTokens: 4000,
      })
    );

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
 * 예시글에서 실제로 쓰인 종결어미를 세어 우세한 패턴을 판정합니다.
 *
 * LLM 판단에만 맡기면 표본과 다른 패턴을 적어내는 일이 있어, 코드로 먼저 세고
 * 그 결과를 프롬프트에 확정값으로 넣습니다.
 */
export function detectSentenceEnding(posts: BlogPost[]): {
  pattern: "요" | "다";
  politeCount: number;
  plainCount: number;
  confidence: number;
} {
  const text = posts.map((p) => p.excerpt).join("\n");

  // 문장 끝(마침표/물음표/느낌표/줄바꿈/문자열 끝) 직전의 어미만 셉니다.
  const boundary = "(?=\\s*(?:[.!?…]|\\n|$))";
  const politeMatches = text.match(new RegExp(`(?:요|죠|네요|어요|아요|세요)${boundary}`, "g"));
  const plainMatches = text.match(new RegExp(`(?:다|까|군|구나)${boundary}`, "g"));

  const politeCount = politeMatches?.length ?? 0;
  const plainCount = plainMatches?.length ?? 0;
  const total = politeCount + plainCount;

  return {
    pattern: politeCount >= plainCount ? "요" : "다",
    politeCount,
    plainCount,
    confidence: total === 0 ? 0 : Math.max(politeCount, plainCount) / total,
  };
}

/**
 * 전문가별 문체 가이드를 생성합니다.
 *
 * 예시글을 받아 "어떻게 쓰는가"(HOW)만 뽑아냅니다. 주제·소재(WHAT)는
 * 의도적으로 제외해, 같은 문체를 다른 소재의 글에도 적용할 수 있게 합니다.
 *
 * @param posts 예시글 (최소 2개, 상한 없음 - 넣은 만큼 전부 분석합니다)
 * @param scope 전문가 구분. 해당 전문가 글의 관습을 함께 고려합니다
 */
export async function analyzeStyleCompact(
  posts: BlogPost[],
  scope: StyleScope = "common"
): Promise<string> {
  try {
    if (posts.length < MIN_STYLE_SAMPLES) {
      throw new Error(`최소 ${MIN_STYLE_SAMPLES}개의 글이 필요합니다`);
    }

    // 상한 없이 받은 예시글을 전부 씁니다.
    const samples = posts;

    const postsContent = samples
      .map((post, index) => `Post ${index + 1}: ${post.title}\nContent:\n${post.excerpt}`)
      .join("\n\n---\n\n");

    // 전문가별 맥락. 'common'이면 특정 분야를 전제하지 않습니다.
    const expert = scope !== "common" ? EXPERTS[scope] : null;
    const domainContext = expert
      ? `These posts come from a Korean "${expert.name}" blog (${expert.description}).
Typical subject matter: ${expert.expertise.join(", ")}.
Keep this genre in mind when describing conventions, but the guide itself must stay topic-agnostic.`
      : `These posts come from a general Korean blog. Do not assume any particular genre.`;

    // 코드로 먼저 세어 확정한 종결어미를 프롬프트에 못 박습니다.
    const ending = detectSentenceEnding(samples);
    const endingLabel = ending.pattern === "요" ? "~~요 (polite)" : "~~다 (plain/declarative)";

    const prompt = `You are a professional writing style analyzer. Analyze these ${samples.length} Korean blog posts and extract ONLY the GENERAL writing style guide - the HOW, not the WHAT.

${postsContent}

CONTEXT:
${domainContext}

MEASURED SENTENCE ENDING (computed from the samples, treat as ground truth):
- Dominant pattern: ${endingLabel}
- Counts: polite(요) ${ending.politeCount} vs plain(다) ${ending.plainCount}
- You MUST report this exact pattern in section 1. Do NOT substitute your own judgement.

Create a style guide in PLAIN TEXT covering:

1. SENTENCE ENDING PATTERN (MOST IMPORTANT):
   - State exactly: "Primary ending style: uses ${ending.pattern === "요" ? "~~요" : "~~다"} endings"
   - List 3-5 concrete ending forms observed in the samples
   - Note any secondary pattern and roughly how often it appears
   - THIS IS THE MOST CRITICAL SECTION - place it FIRST

2. TONE & VOICE:
   - Overall tone (casual, professional, warm, friendly, educational)
   - How emotion is expressed
   - How the reader is addressed and engaged

3. WRITING PATTERN:
   - Typical sentence length (short/medium/long)
   - Sentence structure (simple/complex/varied)
   - Paragraph size and how paragraphs are organized

4. GENERIC EXPRESSIONS & CONNECTORS:
   - Recommendation phrasing, stated generically
   - Transition phrases between ideas
   - Satisfaction and approval phrasing, stated generically
   - Describe the SHAPE of the phrase, never the subject matter

5. NARRATIVE STRUCTURE:
   - Opening style
   - Flow from start to end
   - Closing / call-to-action style

6. EMPHASIS TECHNIQUES:
   - How emphasis is created (repetition, exclamation, spacing, etc.)
   - Descriptive language habits
   - Punctuation patterns

7. READER INTERACTION:
   - Question types used
   - How recommendations are framed
   - Call-to-action patterns

ABSOLUTE RULES - FOLLOW STRICTLY:
- Describe TECHNIQUE only. Strip every proper noun: brand names, dish names, product names, place names, person names
- Replace any subject-specific wording with a generic equivalent so the guide transfers to other topics
- Report the ending pattern that was MEASURED above, even if it is ~~다. Never force ~~요
- NO emojis, NO quotation marks, NO special characters
- Use only: comma, hyphen, period, colon, parenthesis
- Maximum 500 tokens

Output: Plain text, numbered sections only. Start with the SENTENCE ENDING PATTERN section.`;

    const response = await openai.chat.completions.create(
      buildChatParams({
        model: DEFAULT_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are an expert writing style analyzer. Extract detailed, accurate, and actionable style guides based on sample content. Focus on patterns, tone, structure, and conventions. Never invent a pattern that contradicts measurements given to you. Output should be practical for guiding AI-generated content.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.4,
        maxTokens: 6000,
      })
    );

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
