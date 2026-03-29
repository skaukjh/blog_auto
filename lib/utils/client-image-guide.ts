import type { ImageGuide, ImageAnalysisResult } from "@/types/index";
import { parseMarkers } from "./marker-parser";

/**
 * 클라이언트에서 생성된 콘텐츠로부터 간단한 이미지 가이드를 생성합니다
 */
export function generateClientImageGuides(
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

    // 제안 캡션
    const suggestedCaption = analysis.desc || "이미지";

    // 배치 결정
    const placement: "inline" | "standalone" =
      lineNumber === 0 || lineNumber > lines.length
        ? "inline"
        : lines[lineNumber - 1].replace(/\[IMAGE_\d+\]/g, "").trim().length < 10
          ? "standalone"
          : "inline";

    const guide: ImageGuide = {
      index: imageIndex,
      lineNumber,
      paragraphNumber,
      marker: marker.marker,
      suggestedCaption,
      placement,
    };

    guides.push(guide);
  }

  return guides;
}
