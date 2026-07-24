/**
 * HTML 태그 제거 + entity 디코딩 (정규식 기반)
 *
 * 왜 DOMPurify가 아니라 정규식인가:
 *   isomorphic-dompurify는 서버에서 jsdom을 로드하는데, jsdom의 의존성
 *   (html-encoding-sniffer → @exodus/bytes)이 ESM이라 Vercel의 CommonJS
 *   서버리스 런타임에서 `require()` 시 ERR_REQUIRE_ESM 으로 크래시합니다.
 *   (로컬 Turbopack은 넘어가지만 배포본은 500을 냅니다.)
 *
 * 검색 결과 텍스트는 React가 기본 이스케이프하고 dangerouslySetInnerHTML로
 * 쓰이지 않으므로, 태그를 지우고 entity만 풀어도 충분합니다.
 */
export function stripHtmlTags(html: string): string {
  if (!html) return "";

  return html
    .replace(/<[^>]*>/g, "") // 모든 태그 제거
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&") // amp는 마지막에 (이중 디코딩 방지)
    .replace(/\s+/g, " ")
    .trim();
}
