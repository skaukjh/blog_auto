import { openai, DEFAULT_MODEL, OPENAI_MODELS } from "./client";
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

    const response = await openai.chat.completions.create({
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
      max_tokens: 3000,
    });

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
  placeInfo?: PlaceInfo
): Promise<GeneratedContentWithImages> {
  try {
    const expertPrompt = getExpertPrompt(expertType);
    const temperature = 0.3 + (modelConfig.creativity - 1) * 0.1; // 1-10 → 0.3-1.2

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

    userPrompt += `\n\nCRITICAL REQUIREMENTS (IN PRIORITY ORDER):

PRIORITY 1 - SENTENCE ENDINGS (MANDATORY):
CRITICAL: ALL sentences MUST end with ~~요 pattern.
Examples: 맛있어요, 좋았어요, 추천해요
NEVER use: ~~다, ~~한다, ~~했다
100% consistency required.

PRIORITY 2 - IMAGE-BASED DESCRIPTIONS:
- Describe ONLY what is ACTUALLY VISIBLE in the provided images
- Use image descriptions as source of truth
- Rich sensory language based on what you see
- NO generic filler

PRIORITY 3 - NATURAL, WARM TONE & AUTHENTICITY:
- Write like chatting with a close friend
- Use personal reactions and experiences
- Vary sentence structure and openings
- Include practical info and insider tips

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

    // 모델 선택
    const modelKey = (modelConfig.contentGenerationModel || 'gpt-4o') as keyof typeof OPENAI_MODELS;
    const modelName = OPENAI_MODELS[modelKey] || 'gpt-4o';

    const response = await openai.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: "system",
          content: expertPrompt.contentGenerationSystemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      temperature: Math.min(temperature, 2.0), // API 최대값: 2.0
      max_tokens: 3000,
    });

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
