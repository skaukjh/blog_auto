/**
 * 제목·소제목 골격 유틸
 *
 * 사용자가 입력한 제목과 소제목은 **토씨 하나 바꾸지 않고** 최종 글에 들어가야
 * 합니다. 프롬프트로 지시하는 것만으로는 모델이 앞에 "## "를 붙이거나 조사를
 * 살짝 바꾸는 일이 생기므로, 생성 후 코드로 한 번 더 강제합니다.
 *
 * 정책은 종결어미 판정(`detectSentenceEnding`)과 같습니다.
 * 지켜야 하는 규칙은 LLM 판단에 맡기지 않고 코드가 확정합니다.
 */

/** 소제목 최소 개수 */
export const MIN_SUBHEADINGS = 3;

/** 소제목 최대 개수 */
export const MAX_SUBHEADINGS = 10;

/**
 * 소제목 한 개당 본문 분량.
 *
 * 2026-07-25 사용자 지정: 처음 300~500자로 잡았다가 **소제목당 100자씩 더 올려**
 * 400~600자가 되었습니다.
 *
 * 소제목이 있으면 글 전체 길이는 "소제목 개수 × 이 분량"으로 결정됩니다.
 * 사용자가 고르는 글 길이는 이 범위 안에서 어디를 겨냥할지를 정합니다.
 *
 * 프롬프트(content-generator)와 화면 안내(ExpertModeTab)가 같은 값을 보도록
 * 여기 한 곳에만 둡니다.
 */
export const SECTION_CHAR_RANGE: Record<
  'short' | 'medium' | 'long',
  { min: number; max: number }
> = {
  short: { min: 400, max: 450 },
  medium: { min: 450, max: 530 },
  long: { min: 530, max: 600 },
};

/**
 * 두 줄이 "같은 소제목"인지 비교하기 위한 키를 만듭니다.
 *
 * 모델이 흔히 덧붙이는 장식(마크다운 기호, 번호, 대괄호, 끝 콜론)과 모든 공백을
 * 지웁니다. 글자 자체가 바뀐 경우는 일부러 다른 것으로 취급해, 조용히 넘어가지
 * 않고 누락으로 보고되게 합니다.
 */
function headingKey(line: string): string {
  return line
    .trim()
    // 앞머리 장식: # ## ** * - • 1. 1) [ 【 「 (
    .replace(/^[#*\-•\s]+/, '')
    .replace(/^\d+[.)]\s*/, '')
    .replace(/^[[【「(]\s*/, '')
    // 뒤쪽 장식
    .replace(/[\]】」)]\s*$/, '')
    .replace(/[*#]+$/, '')
    .replace(/[:：]\s*$/, '')
    // 공백 차이는 무시
    .replace(/\s+/g, '')
    .toLowerCase();
}

/** 이 줄이 제목이나 소제목 줄인지 (마커 삽입 위치를 피하는 데 씁니다) */
export function isHeadingLine(line: string, title: string, subheadings: string[]): boolean {
  const key = headingKey(line);
  if (!key) return false;
  if (key === headingKey(title)) return true;
  return subheadings.some((sub) => headingKey(sub) === key);
}

export interface EnforceOutlineResult {
  /** 제목·소제목이 입력 원문으로 교정된 글 */
  content: string;
  /** 최종 글에서 끝내 찾지 못한 소제목 (비어 있으면 전부 정상 반영) */
  missingSubheadings: string[];
  /** 제목이 없어서 코드가 맨 앞에 넣었는지 */
  titleInserted: boolean;
}

/**
 * 생성된 글의 제목·소제목을 입력 원문으로 교정합니다.
 *
 * 하는 일:
 *   1) 장식만 붙은 소제목 줄(`## 소제목`, `1. 소제목` 등)을 입력 원문 그대로 되돌립니다.
 *   2) 제목이 첫 줄에 없으면 맨 앞에 넣습니다.
 *   3) 끝내 찾지 못한 소제목을 목록으로 돌려줍니다. 내용을 어디에 붙일지 알 수 없어
 *      임의로 만들어 넣지 않고, 화면에 경고로 띄워 사용자가 재생성을 판단하게 합니다.
 */
export function enforceOutline(
  content: string,
  title: string,
  subheadings: string[]
): EnforceOutlineResult {
  const trimmedTitle = title.trim();
  const cleanSubs = subheadings.map((s) => s.trim()).filter(Boolean);

  const lines = content.split('\n');
  const remaining = new Map<string, string>();
  for (const sub of cleanSubs) {
    remaining.set(headingKey(sub), sub);
  }

  const titleKey = trimmedTitle ? headingKey(trimmedTitle) : '';
  let titleFound = false;

  const fixed = lines.map((line) => {
    const key = headingKey(line);
    if (!key) return line;

    // 제목은 글에 한 번만 둡니다.
    if (!titleFound && titleKey && key === titleKey) {
      titleFound = true;
      return trimmedTitle;
    }

    const original = remaining.get(key);
    if (original) {
      remaining.delete(key);
      // 소제목 줄에는 다른 텍스트를 섞지 않고 소제목만 남깁니다.
      return original;
    }

    return line;
  });

  let result = fixed.join('\n');
  let titleInserted = false;

  if (trimmedTitle && !titleFound) {
    result = `${trimmedTitle}\n\n${result.replace(/^\n+/, '')}`;
    titleInserted = true;
  }

  return {
    content: result,
    missingSubheadings: Array.from(remaining.values()),
    titleInserted,
  };
}
