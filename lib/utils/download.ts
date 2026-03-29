import { Document, Packer, Paragraph } from "docx";
import type { GeneratedContentWithImages } from "@/types/index";

/**
 * 마커 포함 텍스트 생성
 */
export function generateTextWithMarkers(content: GeneratedContentWithImages): string {
  return content.content;
}

/**
 * 마커 제거된 텍스트 생성
 */
export function generatePlainText(content: GeneratedContentWithImages): string {
  return content.content.replace(/\[IMAGE_\d+\]/g, "").trim();
}

/**
 * HTML 형식으로 변환
 */
export function generateHtml(content: GeneratedContentWithImages, includeMarkers: boolean = false): string {
  let htmlContent = includeMarkers ? content.content : content.content.replace(/\[IMAGE_\d+\]/g, "");

  // 마커를 이미지 플레이스홀더로 변환
  if (includeMarkers) {
    htmlContent = htmlContent.replace(/\[IMAGE_(\d+)\]/g, '<div style="text-align: center; margin: 20px 0; padding: 20px; background-color: #f0f0f0; border: 2px dashed #ccc;"><p>[이미지 $1]</p></div>');
  }

  // 줄바꿈을 HTML 태그로 변환
  htmlContent = htmlContent.split("\n").map((line) => {
    if (line.trim() === "") {
      return "<br/>";
    }
    return `<p>${escapeHtml(line)}</p>`;
  }).join("");

  const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>블로그 글</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.8;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
    }
    p {
      margin: 15px 0;
      text-align: justify;
    }
    div[style*="text-align: center"] {
      margin: 30px 0;
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>
  `.trim();

  return html;
}

/**
 * DOCX 형식으로 변환 (바이너리)
 */
export async function generateDocx(
  content: GeneratedContentWithImages,
  includeMarkers: boolean = false
): Promise<Buffer> {
  let textContent = includeMarkers ? content.content : content.content.replace(/\[IMAGE_\d+\]/g, "");

  const lines = textContent.split("\n");
  const paragraphs: Paragraph[] = [];

  for (const line of lines) {
    if (line.trim() === "") {
      paragraphs.push(new Paragraph({ text: "" }));
    } else {
      let text = line;
      if (includeMarkers) {
        text = text.replace(/\[IMAGE_(\d+)\]/g, "[이미지 $1]");
      }

      paragraphs.push(
        new Paragraph({
          text,
          spacing: { line: 360, lineRule: "auto" },
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

/**
 * 텍스트를 클립보드에 복사 (클라이언트 사이드)
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // 모던 브라우저 (HTTPS 또는 localhost)
    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        console.log("✅ 클립보드 복사 성공 (Clipboard API)");
        return true;
      } catch (clipboardErr) {
        console.warn("⚠️ Clipboard API 실패, Fallback 시도:", clipboardErr);
        // Fallback으로 진행
      }
    }

    // Fallback: 구형 브라우저 또는 Clipboard API 실패
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "-9999px";
    document.body.appendChild(textArea);

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      textArea.setSelectionRange(0, text.length);
    } else {
      textArea.select();
    }

    const success = document.execCommand("copy");
    document.body.removeChild(textArea);

    if (success) {
      console.log("✅ 클립보드 복사 성공 (Fallback)");
    } else {
      console.warn("⚠️ 클립보드 복사 실패");
    }

    return success;
  } catch (error) {
    console.error("❌ 클립보드 복사 중 오류:", error);
    return false;
  }
}

/**
 * 파일 다운로드 (클라이언트 사이드)
 */
export async function downloadFile(
  data: string | Buffer,
  filename: string,
  mimeType: string = "text/plain"
): Promise<void> {
  const blob = new Blob([data as any], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * HTML 특수 문자 이스케이프
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };

  return text.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * 파일명 생성 (날짜 포함)
 */
export function generateFilename(format: "txt" | "docx" | "html", title?: string): string {
  const timestamp = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const baseFilename = title ? `${title}_${timestamp}` : `blog_${timestamp}`;

  const extensions: Record<string, string> = {
    txt: "txt",
    docx: "docx",
    html: "html",
  };

  return `${baseFilename}.${extensions[format]}`;
}

/**
 * 다운로드 완료 이벤트 처리
 */
export function triggerDownload(content: GeneratedContentWithImages, format: "txt" | "docx" | "html", title?: string): void {
  const filename = generateFilename(format, title);

  if (format === "txt") {
    const text = generateTextWithMarkers(content);
    downloadFile(text, filename, "text/plain");
  } else if (format === "html") {
    const html = generateHtml(content, true);
    downloadFile(html, filename, "text/html");
  } else if (format === "docx") {
    generateDocx(content, true).then((buffer) => {
      downloadFile(buffer, filename, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    });
  }
}
