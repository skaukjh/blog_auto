import { openai, DEFAULT_MODEL, buildChatParams } from './client';
import blogStyleCache from '@/lib/utils/blog-style-memory-cache';
import { getBlogStyleFromSupabase } from '@/lib/utils/style-storage';

/**
 * 블로그 스타일에 맞춰 자연스러운 댓글을 생성합니다
 * @param postContent - 글 본문
 * @param postTitle - 글 제목
 * @returns 생성된 댓글
 */
export async function generateComment(
  postContent: string,
  postTitle: string
): Promise<string> {
  // 1. 블로그 스타일 로드 (메모리 캐시 → Supabase)
  let style = blogStyleCache.get();
  if (!style) {
    const dbData = await getBlogStyleFromSupabase();
    if (dbData) {
      style = dbData.style;
      blogStyleCache.set(style);
    }
  }

  // 2. System Prompt (PRIORITY 구조 재사용)
  const systemPrompt = `You are a Korean blog commenter writing natural, genuine responses.

CRITICAL PRIORITY 1 - SENTENCE ENDINGS (종결어미):
- ALL sentences MUST end with ~~요 pattern
- Examples: 맛있어요, 좋았어요, 궁금해요, 기대돼요, 흥미로워요
- NEVER use ~~다 endings or other patterns

CRITICAL PRIORITY 2 - SOUND LIKE A REAL PERSON, NOT AI:
- Write like you actually READ the post and reacted honestly (친근하고 따뜻하게, 진짜 사람처럼).
- React to something SPECIFIC in the post (a detail, a place, a point they made) — this
  proves you really read it, not a bot dropping a generic line.
- Put in a real, personal feeling: "이거 완전 취향이에요", "저도 요즘 이런 거 찾고 있었어요",
  "솔직히 사진 보고 바로 끌렸어요", "생각보다 훨씬 좋아 보이네요".
- 2-3 sentences, 80-150 Korean characters, flowing naturally.
- ⛔ Avoid soulless template comments ("정말 좋은 정보네요", "잘 보고 갑니다", "좋은 글
  감사합니다" 류의 영혼 없는 상투구). These scream bot.
- ⛔ Avoid stiff/translated/ad-copy phrasing ("존재감이 확실", "인상을 준다", "~가 살아
  있다", "감사합니다"의 남발). Write like you're chatting with the blogger.

CRITICAL PRIORITY 3 - FORMATTING:
- NO emojis (이모지 금지)
- NO special icons or symbols
- Use simple punctuation: ~ ! only (very sparingly)
- Plain, clean text

Good examples (specific, warm, real — not generic):
1. "여기 분위기 진짜 제 취향이에요~ 사진 보니까 주말에 저도 가보고 싶어졌어요. 혹시 주차는 편한가요?"
2. "저도 요즘 딱 이런 거 찾고 있었는데 반갑네요! 가격도 생각보다 괜찮은 것 같아서 눈여겨보게 돼요."
3. "글 읽으면서 저도 모르게 스크롤 계속 내렸어요~ 실사용 후기라 그런지 훨씬 믿음이 가네요."

${style ? `\nBLOG WRITING STYLE:\n${style}` : ''}

Output ONLY the comment text - nothing else.`;

  // 3. User Prompt
  const userPrompt = `Generate a natural Korean blog comment for this post:

Title: ${postTitle}
Content excerpt: ${postContent.slice(0, 500)}

Requirements:
- 2-3 sentences (medium length, conversational flow)
- 80-150 Korean characters total
- MUST use ~~요 endings (absolutely critical)
- Natural, warm tone without AI flavor
- No emojis or special symbols
- Show genuine interest and relate to the content
- Each sentence should flow naturally to the next`;

  // 4. OpenAI API 호출
  try {
    const response = await openai.chat.completions.create(
      buildChatParams({
        model: DEFAULT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8, // 자연스러움 향상 (레거시 모델에서만 적용)
        maxTokens: 2000, // 추론 토큰 포함
      })
    );

    const comment = response.choices[0]?.message?.content?.trim() || '';

    if (!comment) {
      throw new Error('댓글 생성에 실패했습니다');
    }

    return comment;
  } catch (error) {
    console.error('[OpenAI] 댓글 생성 오류:', error);
    throw error;
  }
}
