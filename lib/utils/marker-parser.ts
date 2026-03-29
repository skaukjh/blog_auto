import type { ContentSegment, MarkerInfo } from "@/types/index";

const MARKER_PATTERN = /\[IMAGE_(\d+)\]/g;

/**
 * 마커를 파싱하고 위치 정보를 추출합니다
 */
export function parseMarkers(content: string): MarkerInfo[] {
  const markers: MarkerInfo[] = [];
  let match;

  while ((match = MARKER_PATTERN.exec(content)) !== null) {
    markers.push({
      index: parseInt(match[1], 10),
      marker: match[0],
      startPos: match.index,
      endPos: match.index + match[0].length,
    });
  }

  return markers;
}

/**
 * 마커 형식이 올바른지 검증합니다
 */
export function validateMarkerFormat(marker: string): boolean {
  const markerRegex = /^\[IMAGE_\d+\]$/;
  return markerRegex.test(marker);
}

/**
 * 전체 콘텐츠에서 마커가 포함되어 있는지 확인합니다
 */
export function hasMarkers(content: string): boolean {
  return MARKER_PATTERN.test(content);
}

/**
 * 콘텐츠를 마커를 기준으로 세그먼트로 나눕니다
 */
export function segmentContentByMarkers(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const markers = parseMarkers(content);

  if (markers.length === 0) {
    return [
      {
        type: "text",
        content,
      },
    ];
  }

  let lastEndPos = 0;

  for (const marker of markers) {
    // 마커 이전의 텍스트
    if (marker.startPos > lastEndPos) {
      segments.push({
        type: "text",
        content: content.substring(lastEndPos, marker.startPos),
      });
    }

    // 마커 자체
    segments.push({
      type: "image",
      content: marker.marker,
      markerInfo: marker,
    });

    lastEndPos = marker.endPos;
  }

  // 마지막 마커 이후의 텍스트
  if (lastEndPos < content.length) {
    segments.push({
      type: "text",
      content: content.substring(lastEndPos),
    });
  }

  return segments;
}

/**
 * 마커를 찾고 그 주변 문맥을 추출합니다
 */
export function getMarkerContext(
  content: string,
  markerIndex: number,
  contextLines: number = 3
): { before: string[]; after: string[] } {
  const lines = content.split("\n");
  const marker = `[IMAGE_${markerIndex}]`;
  let markerLineIndex = -1;

  // 마커가 있는 줄 찾기
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(marker)) {
      markerLineIndex = i;
      break;
    }
  }

  if (markerLineIndex === -1) {
    return { before: [], after: [] };
  }

  // 이전 줄들
  const beforeStart = Math.max(0, markerLineIndex - contextLines);
  const before = lines.slice(beforeStart, markerLineIndex);

  // 이후 줄들
  const afterEnd = Math.min(lines.length, markerLineIndex + contextLines + 1);
  const after = lines.slice(markerLineIndex + 1, afterEnd);

  return { before, after };
}

/**
 * 콘텐츠에서 마커를 제거합니다 (편집 모드에서 마커만 제거)
 */
export function removeMarkers(content: string): string {
  return content.replace(MARKER_PATTERN, "").trim();
}

/**
 * 마커를 특정 문자로 교체합니다
 */
export function replaceMarkers(content: string, replacement: string): string {
  return content.replace(MARKER_PATTERN, replacement);
}

/**
 * 마커 개수를 세어봅니다
 */
export function countMarkers(content: string): number {
  const matches = content.match(MARKER_PATTERN);
  return matches ? matches.length : 0;
}

/**
 * 마커 인덱스 범위를 검증합니다
 */
export function validateMarkerIndices(content: string, maxImageIndex: number): boolean {
  const markers = parseMarkers(content);

  for (const marker of markers) {
    if (marker.index < 1 || marker.index > maxImageIndex) {
      return false;
    }
  }

  return true;
}

/**
 * 마커가 순차적으로 배치되어 있는지 확인합니다
 */
export function areMarkersSequential(content: string): boolean {
  const markers = parseMarkers(content);
  if (markers.length === 0) return true;

  for (let i = 0; i < markers.length; i++) {
    if (markers[i].index !== i + 1) {
      return false;
    }
  }

  return true;
}

/**
 * 마커들이 줄 단위로 배치되어 있는지 확인합니다
 */
export function areMarkersOnSeparateLines(content: string): boolean {
  const lines = content.split("\n");

  for (const line of lines) {
    const markerMatches = line.match(MARKER_PATTERN);
    if (markerMatches && markerMatches.length > 1) {
      return false; // 같은 줄에 여러 마커 존재
    }
  }

  return true;
}
