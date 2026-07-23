import fs from "fs";
import path from "path";

/**
 * 블로그 스타일 파일 저장소
 *
 * 저장 위치: <저장소 루트>/data/blog-style.txt
 * - 자동화 프로젝트(B)도 같은 파일을 읽으므로 저장소 루트에 둡니다
 * - 분석 시각은 파일의 mtime을 사용합니다 (별도 메타 파일 불필요)
 *
 * ⚠️ Vercel 제약
 * 배포 환경의 파일시스템은 읽기 전용이라 쓰기는 실패합니다.
 * 따라서 스타일 분석은 로컬에서 수행하고, 생성된 txt를 커밋해서 배포하세요.
 * 배포 환경에서 분석을 실행해도 결과는 응답으로 돌아가 세션 동안은 사용 가능합니다.
 */

const STYLE_DIR = path.join(process.cwd(), "data");
const STYLE_FILE = path.join(STYLE_DIR, "blog-style.txt");

/** 배포 환경(파일시스템 읽기 전용) 여부 */
function isReadOnlyFs(): boolean {
  return Boolean(process.env.VERCEL);
}

/**
 * 블로그 스타일을 txt 파일로 저장합니다.
 * @returns 실제로 파일에 기록됐으면 true
 */
export function saveBlogStyleToFile(style: string): boolean {
  if (isReadOnlyFs()) {
    console.warn(
      "⚠️ 배포 환경에서는 스타일 파일을 쓸 수 없습니다. data/blog-style.txt를 커밋해 배포하세요."
    );
    return false;
  }

  try {
    fs.mkdirSync(STYLE_DIR, { recursive: true });
    fs.writeFileSync(STYLE_FILE, style, "utf-8");
    console.log(`✅ 블로그 스타일 저장 완료: ${STYLE_FILE}`);
    return true;
  } catch (error) {
    console.error("❌ 블로그 스타일 파일 저장 실패:", error);
    return false;
  }
}

/**
 * 저장된 블로그 스타일을 읽습니다.
 * @returns 스타일과 분석 시각(파일 mtime), 없으면 null
 */
export function getBlogStyleFromFile(): { style: string; analyzedAt: string } | null {
  try {
    if (!fs.existsSync(STYLE_FILE)) {
      console.log("ℹ️ 저장된 블로그 스타일 파일이 없습니다");
      return null;
    }

    const style = fs.readFileSync(STYLE_FILE, "utf-8").trim();

    if (!style) {
      console.warn("⚠️ 스타일 파일이 비어 있습니다");
      return null;
    }

    const analyzedAt = fs.statSync(STYLE_FILE).mtime.toISOString();
    console.log("✅ 파일에서 블로그 스타일 로드 완료");
    return { style, analyzedAt };
  } catch (error) {
    console.error("❌ 블로그 스타일 파일 읽기 실패:", error);
    return null;
  }
}

/**
 * 저장된 블로그 스타일 파일을 삭제합니다.
 */
export function deleteBlogStyleFile(): boolean {
  if (isReadOnlyFs()) {
    console.warn("⚠️ 배포 환경에서는 스타일 파일을 삭제할 수 없습니다");
    return false;
  }

  try {
    if (fs.existsSync(STYLE_FILE)) {
      fs.unlinkSync(STYLE_FILE);
      console.log("✅ 블로그 스타일 파일 삭제 완료");
    }
    return true;
  } catch (error) {
    console.error("❌ 블로그 스타일 파일 삭제 실패:", error);
    return false;
  }
}
