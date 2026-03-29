import type { ImageGuide, ImageAnalysisResult } from "@/types/index";
import { parseMarkers } from "./marker-parser";

/**
 * 이미지 가이드 배열을 생성합니다
 */
export function generateImageGuides(
  content: string,
  imageAnalysis: ImageAnalysisResult
): ImageGuide[] {
  const lines = content.split("\n");
  const markers = parseMarkers(content);
  const guides: ImageGuide[] = [];

  for (const marker of markers) {
    const imageIndex = marker.index;
    const analysis = imageAnalysis.images.find((img) => img.idx === imageIndex);

    if (!analysis) {
      continue;
    }

    // 마커가 있는 줄 찾기
    let lineNumber = 0;
    let paragraphNumber = 0;
    let currentParagraph = 0;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === "") {
        currentParagraph++;
      } else if (lines[i].includes(marker.marker)) {
        lineNumber = i + 1;
        paragraphNumber = currentParagraph + 1;
        break;
      }
    }

    // 제안 캡션 생성
    const suggestedCaption = generateSuggestedCaption(analysis);

    const guide: ImageGuide = {
      index: imageIndex,
      marker: marker.marker,
      lineNumber,
      paragraphNumber,
      suggestedCaption,
      placement: determinePlacement(lines, lineNumber),
    };

    guides.push(guide);
  }

  // 인덱스 순서로 정렬
  guides.sort((a, b) => a.index - b.index);

  return guides;
}

/**
 * 제안 캡션을 생성합니다
 */
function generateSuggestedCaption(analysis: { desc: string; mood: string; cats: unknown[] }): string {
  const description = analysis.desc || "사진";
  const mood = analysis.mood || "";

  if (mood) {
    return `${description} (${mood})`;
  }

  return description;
}

/**
 * 마커의 배치 유형을 결정합니다 (인라인 vs 독립형)
 */
function determinePlacement(lines: string[], lineNumber: number): "inline" | "standalone" {
  if (lineNumber === 0 || lineNumber > lines.length) {
    return "inline";
  }

  const line = lines[lineNumber - 1];
  const textLength = line.replace(/\[IMAGE_\d+\]/g, "").trim().length;

  // 마커만 있거나 거의 없으면 독립형
  return textLength < 10 ? "standalone" : "inline";
}

/**
 * 이미지 인덱스별로 가이드를 조직합니다
 */
export function organizeGuidesByIndex(guides: ImageGuide[]): Map<number, ImageGuide> {
  const map = new Map<number, ImageGuide>();

  for (const guide of guides) {
    map.set(guide.index, guide);
  }

  return map;
}

/**
 * 특정 이미지 인덱스의 가이드를 가져옵니다
 */
export function getGuideByIndex(guides: ImageGuide[], index: number): ImageGuide | undefined {
  return guides.find((g) => g.index === index);
}

/**
 * 가이드에서 이미지 설명을 추출합니다
 */
export function extractDescriptionFromGuide(guide: ImageGuide): string {
  return guide.suggestedCaption;
}

/**
 * 가이드에서 이미지 컨텍스트를 추출합니다 (줄 번호 기반)
 */
export function extractContextFromGuide(guide: ImageGuide, content: string): string {
  const lines = content.split("\n");
  const contextBefore = lines.slice(Math.max(0, guide.lineNumber - 3), guide.lineNumber).join(" ");
  const contextAfter = lines.slice(guide.lineNumber, Math.min(lines.length, guide.lineNumber + 3)).join(" ");
  return `${contextBefore} ${contextAfter}`.trim();
}

/**
 * 가이드 정보를 포맷팅된 문자열로 변환합니다
 */
export function formatGuideAsText(guide: ImageGuide): string {
  return `
📍 이미지 ${guide.index}
위치: ${guide.lineNumber}줄, ${guide.paragraphNumber}번째 문단
배치: ${guide.placement === "inline" ? "인라인" : "독립형"}

💡 제안 캡션:
${guide.suggestedCaption}
`.trim();
}

/**
 * 모든 가이드를 포맷팅된 문자열로 변환합니다
 */
export function formatAllGuidesAsText(guides: ImageGuide[]): string {
  return guides.map((guide) => formatGuideAsText(guide)).join("\n\n---\n\n");
}

/**
 * 가이드 요약 정보를 생성합니다
 */
export function generateGuidesSummary(guides: ImageGuide[]): {
  totalImages: number;
  inlineImages: number;
  standaloneImages: number;
} {
  const inlineImages = guides.filter((g) => g.placement === "inline").length;
  const standaloneImages = guides.length - inlineImages;

  return {
    totalImages: guides.length,
    inlineImages,
    standaloneImages,
  };
}
