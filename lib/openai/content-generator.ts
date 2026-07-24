import {
  openai,
  DEFAULT_MODEL,
  CONTENT_MODEL,
  resolveModel,
  buildChatParams,
  supportsTemperature,
} from "./client";
import { CONTENT_GENERATOR_SYSTEM_PROMPT } from "./prompts";
import { getExpertPrompt } from "@/lib/experts/prompts";
import { parseMarkers } from "@/lib/utils/marker-parser";
import type {
  GeneratedContentWithImages,
  ImageAnalysisResult,
  KeywordItem,
  PlaceInfo,
  ExpertType,
  ModelConfig,
  WebSearchResult,
  RecommendationItem,
} from "@/types/index";

/**
 * GPT-4o를 사용한 콘텐츠 생성 비용을 계산합니다 (USD)
 */
export function calculateGenerationCost(
  inputTokens: number,
  outputTokens: number
): number {
  // gpt-4o 가격: 입력 $2.5/1M tokens, 출력 $10/1M tokens
  const inputCost = (inputTokens / 1000000) * 2.5;
  const outputCost = (outputTokens / 1000000) * 10;
  return inputCost + outputCost;
}

/**
 * 생성 비용을 추정합니다 (USD)
 */
export function estimateGenerationCost(
  topic: string,
  keywords: KeywordItem[]
): number {
  const promptSize = topic.length + keywords.reduce((sum, k) => sum + k.text.length, 0) + 500;
  const outputTokens = 2500; // 평균 출력 토큰 (2000-3000)

  const inputTokens = Math.ceil(promptSize / 4);
  // gpt-4o 가격: 입력 $2.5/1M, 출력 $10/1M
  const cost = (inputTokens / 1000000) * 2.5 + (outputTokens / 1000000) * 10;

  return cost;
}

/**
 * 키워드가 모두 삽입되었는지 확인합니다
 */
export function validateKeywordInsertion(
  content: string,
  keywords: KeywordItem[]
): { valid: boolean; missingKeywords: string[] } {
  const missingKeywords: string[] = [];

  for (const keyword of keywords) {
    const regex = new RegExp(keyword.text, "i");
    if (!regex.test(content)) {
      missingKeywords.push(keyword.text);
    }
  }

  return {
    valid: missingKeywords.length === 0,
    missingKeywords,
  };
}

/**
 * 가게 정보를 블로그 글 형식으로 포맷팅합니다
 * 사용자가 요청한 정확한 형식:
 * 원조해장촌 뼈구이한판 감자탕 선릉역점
 * 📍 서울 강남구 선릉로86길 28 지상2층
 * ⏰ 월~금 11:00 - 23:00
 * 라스트오더 22:00
 * 토~일 12:00 - 22:00
 * 라스트오더 21:00
 * 📞 0507-1407-9915
 *
 * 💬 실제 고객 리뷰 포함 (사용자 선택)
 */
function formatPlaceInfo(placeInfo: PlaceInfo): string {
  let info = `${placeInfo.name}\n`;

  if (placeInfo.address) {
    info += `📍 ${placeInfo.address}\n`;
  }

  if (placeInfo.openingHours && placeInfo.openingHours.length > 0) {
    // 첫 번째 영업시간 앞에 ⏰ 추가
    info += `⏰ ${placeInfo.openingHours[0]}\n`;

    // 나머지 영업시간들은 그대로 추가 (라스트오더 등)
    for (let i = 1; i < placeInfo.openingHours.length; i++) {
      info += `${placeInfo.openingHours[i]}\n`;
    }
  }

  if (placeInfo.phone) {
    info += `📞 ${placeInfo.phone}\n`;
  }

  if (placeInfo.rating) {
    info += `⭐ 평점: ${placeInfo.rating}/5.0\n`;
  }

  // 리뷰 추가 (사용자가 선택한 리뷰만 포함)
  if (placeInfo.reviews && placeInfo.reviews.length > 0) {
    info += `\n💬 실제 고객 리뷰 (선택된 ${placeInfo.reviews.length}개):\n`;
    placeInfo.reviews.forEach((review, idx) => {
      info += `\n${idx + 1}. ${review.author} (⭐ ${review.rating}/5)\n`;
      info += `"${review.text}"\n`;
      info += `- ${new Date(review.time).toLocaleDateString('ko-KR')}\n`;
    });
    info += `\n위 리뷰를 블로그 글에 자연스럽게 언급해주세요. 고객 평가가 실제 경험을 반영하므로 신뢰도를 높여줍니다.\n`;
  }

  return info;
}

/**
 * 사용자 요청에 따라 생성된 블로그 글을 수정합니다
 */
export async function refineBlogContent(
  currentContent: string,
  userRequest: string,
  keywords: KeywordItem[],
  imageAnalysis: ImageAnalysisResult,
  _placeInfo?: PlaceInfo
): Promise<string> {
  try {
    const imageCount = imageAnalysis.images.length;
    const keywordList = keywords.map((k) => `${k.text} (${k.count}회)`).join(", ");

    let userPrompt = `You are a professional Korean blog writer. The user has requested a modification to an existing blog post.

CURRENT CONTENT:
"""
${currentContent}
"""

USER REQUEST:
"${userRequest}"

TASK: Modify the content according to the user's request while maintaining:
1. All ${imageCount} image markers: ${Array.from({ length: imageCount }, (_, i) => `[IMAGE_${i + 1}]`).join(", ")}
2. Keywords naturally included (${keywords.length} total): ${keywordList}
3. Korean language with ~~요 sentence endings (MANDATORY)
4. Natural, warm, conversational tone
5. Image-based descriptions only (describe what's visible)
6. No emojis or icons

CRITICAL RULES:
- PRESERVE all [IMAGE_N] markers in their original positions
- Keep keyword usage intact
- Improve readability and flow based on the user's request
- Maintain the overall structure and length
- Use only ~~요 sentence endings (맛있어요, 좋았어요, 추천해요, etc.)

Output ONLY the modified blog post content. No explanations.`;

    const response = await openai.chat.completions.create(
      buildChatParams({
        model: DEFAULT_MODEL,
        messages: [
          {
            role: "system",
            content: CONTENT_GENERATOR_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        temperature: 0.7,
        maxTokens: 12000,
      })
    );

    let refinedContent = response.choices[0]?.message?.content || "";

    if (!refinedContent) {
      throw new Error("수정된 콘텐츠를 받을 수 없습니다");
    }

    // 마커 검증 - 수정 후에도 마커 개수 확인
    const expectedMarkerCount = imageCount;
    const markers = parseMarkers(refinedContent);

    if (markers.length !== expectedMarkerCount) {
      console.warn(`마커 개수 불일치: 예상 ${expectedMarkerCount}개, 실제 ${markers.length}개. 마커 재정렬 시도`);

      // 마커가 없으면 원본의 마커를 복사해서 추가
      if (markers.length === 0) {
        const originalMarkers = parseMarkers(currentContent);
        if (originalMarkers.length === expectedMarkerCount) {
          // 원본에서 마커 위치 정보 추출
          for (let i = 0; i < expectedMarkerCount; i++) {
            refinedContent += `\n[IMAGE_${i + 1}]`;
          }
        }
      } else if (markers.length > expectedMarkerCount) {
        // 초과 마커 제거
        refinedContent = removeExcessMarkers(refinedContent, expectedMarkerCount);
      } else if (markers.length < expectedMarkerCount) {
        // 부족한 마커 추가
        refinedContent = insertMissingMarkers(refinedContent, expectedMarkerCount);
      }
    }

    return refinedContent;
  } catch (error) {
    console.error("콘텐츠 수정 오류:", error);
    throw error;
  }
}

/**
 * 종결어미 규칙을 정합니다.
 *
 * 우선순위:
 *   1) forcedEnding — 글쓰기 가이드가 종결어미를 지배하도록 설정된 경우(사용자 결정 2026-07-24).
 *      학습된 전문가 문체의 어미보다 이 값이 우선합니다.
 *   2) 학습 문체 가이드의 "uses ~~다 endings" 문구
 *   3) 기본값 ~~요
 *
 * @param styleGuide  학습된 전문가 문체 가이드
 * @param forcedEnding 가이드가 강제하는 종결어미('요'|'다'). 있으면 학습 문체를 무시합니다.
 */
function resolveEndingRule(
  styleGuide?: string,
  forcedEnding?: "요" | "다" | null
): string {
  const usePlain = forcedEnding
    ? forcedEnding === "다"
    : /uses\s*~*\s*다\s*endings/i.test(styleGuide ?? "");

  if (usePlain) {
    return `ALL sentences MUST end with the ~~다 pattern.
Examples: 좋았다, 추천한다, 방문했다
NEVER use: ~~요, ~~해요, ~~네요`;
  }

  return `ALL sentences MUST end with the ~~요 pattern.
Examples: 좋았어요, 추천해요, 방문했어요
NEVER use: ~~다, ~~한다, ~~했다`;
}

/**
 * Phase 20: 전문가 기반 블로그 콘텐츠 생성
 * 웹 검색 결과와 추천 정보를 통합합니다
 */
export async function generateBlogContentExpert(
  topic: string,
  length: "short" | "medium" | "long",
  keywords: KeywordItem[],
  imageAnalysis: ImageAnalysisResult,
  expertType: ExpertType,
  modelConfig: ModelConfig,
  webSearchResults?: WebSearchResult[],
  recommendations?: RecommendationItem[],
  startSentence?: string,
  endSentence?: string,
  placeInfo?: PlaceInfo,
  /**
   * /format 에서 학습한 이 전문가의 문체 가이드.
   * 없으면 전문가 페르소나의 기본 톤만으로 생성합니다.
   */
  styleGuide?: string | null,
  /**
   * 참고 자료(전자책·프롬프트 자료집)를 분석해 둔 글 구조 가이드.
   *
   * 문체(styleGuide)와 역할이 다릅니다. 이쪽은 "어떤 구조로 쓰는가"를 담습니다.
   * 없으면 구조 지시 없이 생성합니다.
   */
  writingGuide?: string | null,
  /**
   * 글쓰기 가이드가 강제하는 종결어미('요'|'다').
   *
   * 사용자 결정(2026-07-24): 이 값이 있으면 **학습된 전문가 문체의 어미를 무시하고**
   * 모든 글을 이 어미로 씁니다. null이면 학습 문체를 따릅니다.
   */
  forcedEnding?: "요" | "다" | null
): Promise<GeneratedContentWithImages> {
  try {
    const expertPrompt = getExpertPrompt(expertType);
    const modelName = resolveModel(modelConfig.contentGenerationModel, CONTENT_MODEL);
    const temperature = 0.3 + (modelConfig.creativity - 1) * 0.1; // 1-10 → 0.3-1.2

    // GPT-5 이상 계열은 temperature를 받지 않으므로, 창의성 수준을
    // 프롬프트 지시문으로 전달해 슬라이더가 계속 의미를 갖도록 합니다.
    const creativityDirective = supportsTemperature(modelName)
      ? ""
      : `\n\n⚠️ CREATIVITY LEVEL: ${modelConfig.creativity}/10
${
  modelConfig.creativity <= 3
    ? "Stay close to the source material. Use plain, predictable phrasing and avoid embellishment."
    : modelConfig.creativity <= 7
      ? "Balance faithfulness with lively expression. Vary sentence rhythm naturally."
      : "Be vivid and expressive. Use bold imagery and varied sentence structure, but never invent facts that are not visible in the images or provided data."
}`;

    // 기본 설정
    const charCount = {
      short: "1500-2000",
      medium: "2000-2500",
      long: "2500-3000",
    }[length];

    const keywordList = keywords.map((k) => `${k.text} (${k.count}회)`).join(", ");
    const imageCount = imageAnalysis.images.length;

    // 이미지 설명
    const imageDescriptions = imageAnalysis.images
      .map(
        (img) =>
          `Image ${img.idx}: ${img.desc} (Mood: ${img.mood}, Visual: ${img.visualDetails || 'N/A'})`
      )
      .join('\n');

    // 웹 검색 결과 통합
    let webSearchSection = '';
    if (webSearchResults && webSearchResults.length > 0) {
      webSearchSection = `
⚠️ WEB SEARCH INTEGRATION:
Based on web search for "${topic}":
${webSearchResults
  .map(
    (result, idx) => `
${idx + 1}. ${result.title}
   Source: ${result.source}
   Content: ${result.snippet}`
  )
  .join('\n')}

CRITICAL: Naturally incorporate these web search findings into your content.`
    }

    // 추천 정보 통합
    let recommendationsSection = '';
    if (recommendations && recommendations.length > 0) {
      recommendationsSection = `
⚠️ RECOMMENDATIONS TO INCLUDE:
${recommendations
  .map(
    (rec, idx) => `
${idx + 1}. ${rec.title} (${rec.type})
   ${rec.description}
   ${rec.rating ? `Rating: ${rec.rating}` : ''}
   ${rec.address ? `Address: ${rec.address}` : ''}`
  )
  .join('\n')}

CRITICAL: Weave these recommendations naturally into your content.`
    }

    // User Prompt 생성
    let userPrompt = `Generate a Korean blog post by an expert ${expertType} blogger with the following specifications:

Topic: ${topic}
Character count: ${charCount} characters (Korean characters, not words)
Length: ${length}
Expert Style: ${expertType} blogger persona

Keywords to include naturally (${keywords.length} total):
${keywordList}

⚠️ KEYWORD INCLUSION RULES:
- The numbers shown above are MINIMUM occurrences
- Include keywords naturally throughout the text, not forced
- Distribute keywords evenly to maintain natural flow

⚠️ IMAGE PLACEMENT (CRITICAL):
- TOTAL IMAGES: ${imageCount}
- Use EXACTLY ${imageCount} image marker(s): ${Array.from({ length: imageCount }, (_, i) => `[IMAGE_${i + 1}]`).join(", ")}
- RULE: Place [IMAGE_N] markers where they fit the NARRATIVE FLOW naturally
- Each marker MUST have 1-2 sentences of RELATED context before and after it

Image context and placement guide:
- Theme: ${imageAnalysis.overall.theme}
- Style: ${imageAnalysis.overall.style}
- Suggestions: ${
      Array.isArray(imageAnalysis.overall.suggestions)
        ? imageAnalysis.overall.suggestions.join("; ")
        : "Place images naturally throughout the content"
    }

Detailed image descriptions (use these to decide WHERE to place markers):
${imageDescriptions}
${webSearchSection}
${recommendationsSection}`;

    if (startSentence) {
      userPrompt += `\n\nStart with: "${startSentence}"`;
    }

    if (endSentence) {
      userPrompt += `\n\nEnd with: "${endSentence}"`;
    }

    if (placeInfo) {
      const placeInfoText = formatPlaceInfo(placeInfo);
      userPrompt += `\n\n⚠️ PLACE INFORMATION:
${placeInfoText}`;
    }

    // 학습된 문체가 있으면 프롬프트에 싣고, 종결어미도 거기서 끌어옵니다.
    const trimmedGuide = styleGuide?.trim();
    if (trimmedGuide) {
      userPrompt += `\n\n⚠️ LEARNED WRITING STYLE (analyzed from this author's own ${expertType} posts):
${trimmedGuide}

CRITICAL: This style guide describes HOW this author writes. Reproduce these habits -
sentence endings, rhythm, paragraph shape, transitions, and closing style.
It intentionally contains no subject matter; take only the technique from it.`;
    }

    const endingRule = resolveEndingRule(trimmedGuide, forcedEnding);

    // 가이드가 종결어미를 지배하면, 학습 문체 안내에 딸려온 반대 어미 지시를 무효화합니다.
    const forcedEndingNote = forcedEnding
      ? `\nNOTE: The reference guide dictates the ~~${forcedEnding} ending for ALL posts.
If the learned style above mentions a different ending, IGNORE that part and use ~~${forcedEnding}.
Still borrow the learned style's vocabulary, rhythm, and paragraph shape.`
      : "";

    userPrompt += `\n\nCRITICAL REQUIREMENTS (IN PRIORITY ORDER):

PRIORITY 1 - SENTENCE ENDINGS (MANDATORY):
${endingRule}${forcedEndingNote}
100% consistency required - never mix ending styles within the post.

PRIORITY 2 - IMAGE-BASED DESCRIPTIONS:
- Every VISUAL claim (color, shape, material look, layout) must match what is actually
  in the images — do not invent visual details or fabricate specs/numbers not shown.
- BUT you may add plausible first-person experience around what's visible (how it felt
  to use, the moment of unboxing, daily-life scenes). Experience ≠ fabricated spec:
  describing "조립하면서 살짝 헤맸어요" is fine; inventing "무게 3kg, 내구성 5년" is NOT.
- Rich sensory language grounded in what you see, plus the lived story around it.
- ⛔ NEVER mention photo-taking or photo-editing (보정, 크롭, 회전, 노출, 수평 맞추기,
  화면 캡처 등). The reader only sees the finished photos; writing about how a photo was
  shot or adjusted instantly breaks immersion and screams "AI wrote this".
- NO generic filler.

PRIORITY 3 - SOUND LIKE A REAL PERSON, NOT AI (VERY IMPORTANT):
- Default to a warm, casual, friendly voice — like telling a close friend about
  something you actually bought and used. This friendly tone is the baseline for
  every post, regardless of topic.
- ⛔ NO section headings or sub-titles. Do NOT write lines like "첫인상을 살펴봐요",
  "구성품을 확인해요", "디자인과 마감을 봐요". The post must read as connected
  paragraphs that flow naturally, not a list of labeled sections.
- Kill the "AI smell": AI writing gives itself away by (a) hedging in every
  paragraph ("사진만으로 판단하기 어려워요", "확인되지 않아요"), (b) a mechanical
  rhythm where every sentence is the same length and shape, (c) textbook connectors
  ("~인 만큼", "~하는 편이 좋아요") repeated over and over, (d) a formulaic
  pros/cons summary at the end. Avoid ALL of these.
- Hedge at most once or twice in the whole post, only when it genuinely matters,
  and say it casually — not as a repeated disclaimer.
- Vary sentence length and openings a lot. Mix short punchy sentences with longer
  ones. Start sentences differently.
- ⭐ Pour in STRONG, specific personal feelings and emotions — this is the heart of a
  real review. Not neutral observations, but how it actually made you feel:
  "이거 진짜 편하더라고요", "생각보다 훨씬 튼튼해서 놀랐어요", "솔직히 이 가격이면
  아깝지 않아요", "쓸수록 정드는 느낌이에요", "이 부분은 좀 아쉬웠어요". Be warm,
  honest, a little opinionated — like recommending something to a friend you care about.
- ⭐ Fill the post with RICH, LIVED EXPERIENCE. Don't just describe what things look
  like — tell the little story around them: the moment you opened the box, how the
  assembly actually went, when and where you used it in daily life, what surprised or
  annoyed you, how it changed a small part of your routine.
- Listing the parts / 구성품 is totally fine (쿠션 2개, 볼트, 육각렌치, 설명서 등).
  Just don't leave it as a cold inventory — add a quick reaction or what you did with
  them ("볼트가 딱 4개라 잃어버릴 일 없어 좋았어요").
- Open with a concrete, personal moment or scene — not a generic problem statement
  everyone already knows.
- Vary how you end. Avoid formulaic closers like "~될 거예요", "고려해 볼 만해요"
  repeated as a template. End the way a real person would trail off after a review.
- Use everyday spoken Korean, not formal report language.

PRIORITY 4 - TECHNICAL REQUIREMENTS (STRICT MARKER RULES):
🚫 MARKER RULES - DO NOT VIOLATE:
- MANDATORY: Use EXACTLY ${imageCount} markers TOTAL - NO MORE, NO LESS
- CRITICAL: Use markers [IMAGE_1] through [IMAGE_${imageCount}] ONLY
- FORBIDDEN: Do NOT use markers beyond [IMAGE_${imageCount}]
- FORBIDDEN: Do NOT repeat the same marker twice
- Place [IMAGE_N] markers at natural, contextually relevant locations
- Each marker needs 1-2 sentences of visual description before/after it
- Space markers evenly throughout the post
- VERIFICATION: Count all markers - must equal exactly ${imageCount}
- Keywords must appear naturally, not forced
- NO emojis or icons

PRIORITY 5 - QUALITY & ENGAGEMENT:
- Write with rich, experiential descriptions
- Include sensory details and practical tips
- Make it engaging and valuable for readers`;

    // 참고 자료에서 뽑아 둔 구조 가이드.
    const trimmedWritingGuide = writingGuide?.trim();
    if (trimmedWritingGuide) {
      userPrompt += `\n\nPRIORITY 6 - POST STRUCTURE (from the author's reference material):
${trimmedWritingGuide}

HOW TO APPLY THIS SECTION:
- These are STRUCTURAL rules: what to cover, what facts to include, how to close.
- The sentence ending is fixed by PRIORITY 1 above. If this section's tone hints at a different
  ending, follow PRIORITY 1 for endings and take only the structure from here.
- ⛔ Even if this section suggests using sub-headings/소제목, DO NOT add them. PRIORITY 3's
  "no headings, natural flow" rule wins. Cover the same points as flowing paragraphs instead.
- Do not invent facts to satisfy a structural rule. If a required detail (price, distance,
  time) is not present in the provided images or supplied data, omit it rather than guess.`;
    }

    userPrompt += creativityDirective;

    const response = await openai.chat.completions.create(
      buildChatParams({
        model: modelName,
        messages: [
          {
            role: "system",
            content: trimmedGuide
              ? `${expertPrompt.contentGenerationSystemPrompt}

⚠️ STYLE OVERRIDE: The user supplied a learned style guide in the user message.
Where this persona's default tone conflicts with that guide, THE GUIDE WINS -
especially for sentence endings. The persona governs domain expertise and what to
notice; the guide governs how the sentences sound.`
              : expertPrompt.contentGenerationSystemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        temperature: Math.min(temperature, 2.0), // 레거시 모델에서만 적용
        maxTokens: 12000,
      })
    );

    let content = response.choices[0]?.message?.content || "";

    if (!content) {
      throw new Error("콘텐츠 생성 응답을 받을 수 없습니다");
    }

    // 마커 검증
    const expectedMarkerCount = imageAnalysis.images.length;
    let markers = parseMarkers(content);

    if (markers.length === 0) {
      content = insertMissingMarkers(content, expectedMarkerCount);
    } else if (markers.length > expectedMarkerCount) {
      content = removeExcessMarkers(content, expectedMarkerCount);
    } else if (markers.length < expectedMarkerCount) {
      content = insertMissingMarkers(content, expectedMarkerCount);
    }

    // 최종 검증
    const finalMarkers = parseMarkers(content);
    if (finalMarkers.length !== expectedMarkerCount) {
      throw new Error(`마커 개수 불일치: 예상 ${expectedMarkerCount}개, 실제 ${finalMarkers.length}개`);
    }

    // 키워드 개수 세기
    const keywordCounts: Record<string, number> = {};
    for (const keyword of keywords) {
      const count = (content.match(new RegExp(keyword.text, "gi")) || []).length;
      keywordCounts[keyword.text] = count;
    }

    // 글자 수 계산
    const charCountValue = content.replace(/\[IMAGE_\d+\]/g, "").length;

    return {
      content,
      imageGuides: [],
      wordCount: charCountValue,
      keywordCounts,
    };
  } catch (error) {
    console.error("전문가 콘텐츠 생성 오류:", error);
    throw error;
  }
}

/**
 * 부족한 마커를 삽입합니다
 */
function insertMissingMarkers(content: string, imageCount: number): string {
  const lines = content.split("\n");
  const markerCount = imageCount;
  const linesPerMarker = Math.floor(lines.length / (markerCount + 1));

  let currentLine = linesPerMarker;
  for (let i = 1; i <= markerCount; i++) {
    if (currentLine < lines.length) {
      lines.splice(currentLine, 0, `[IMAGE_${i}]`);
      currentLine += linesPerMarker + 1;
    }
  }

  return lines.join("\n");
}

/**
 * 초과 마커를 제거하고 인덱스를 재정렬합니다
 */
function removeExcessMarkers(content: string, maxImageCount: number): string {
  const markers = parseMarkers(content);
  let result = content;

  // 역순으로 처리하여 위치 이동을 방지
  for (let i = markers.length - 1; i >= maxImageCount; i--) {
    const marker = markers[i];
    result = result.replace(marker.marker, "").trim();
  }

  // 남은 마커의 인덱스를 1부터 재정렬
  let newContent = result;
  for (let i = 1; i <= maxImageCount; i++) {
    const oldMarker = `[IMAGE_${i}]`;
    if (!newContent.includes(oldMarker)) {
      for (let j = i + 1; newContent.includes(`[IMAGE_${j}]`); j++) {
        newContent = newContent.replace(`[IMAGE_${j}]`, oldMarker);
        break;
      }
    }
  }

  return newContent;
}
