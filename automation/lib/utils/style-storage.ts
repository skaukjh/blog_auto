import fs from "fs";
import path from "path";

/**
 * 블로그 스타일 파일 읽기 (읽기 전용)
 *
 * 스타일 분석/저장은 글 생성 앱(A)이 담당하고, 자동화(B)는 읽기만 합니다.
 * 파일 위치: <저장소 루트>/data/blog-style.txt
 * B의 실행 디렉터리는 automation/ 이므로 상위 폴더를 먼저 탐색합니다.
 */

const CANDIDATE_PATHS = [
  path.join(process.cwd(), "..", "data", "blog-style.txt"), // 저장소 루트 (일반적인 경우)
  path.join(process.cwd(), "data", "blog-style.txt"), // B를 단독 배치한 경우
];

/**
 * 저장된 블로그 스타일을 읽습니다.
 * @returns 스타일과 분석 시각(파일 mtime), 없으면 null
 */
export function getBlogStyleFromFile(): { style: string; analyzedAt: string } | null {
  for (const filePath of CANDIDATE_PATHS) {
    try {
      if (!fs.existsSync(filePath)) continue;

      const style = fs.readFileSync(filePath, "utf-8").trim();
      if (!style) continue;

      const analyzedAt = fs.statSync(filePath).mtime.toISOString();
      console.log(`✅ 블로그 스타일 로드 완료: ${filePath}`);
      return { style, analyzedAt };
    } catch (error) {
      console.warn(`⚠️ 스타일 파일 읽기 실패 (${filePath}):`, error);
    }
  }

  console.log(
    "ℹ️ 저장된 블로그 스타일이 없습니다. 글 생성 앱의 /format 에서 먼저 스타일을 분석하세요."
  );
  return null;
}
