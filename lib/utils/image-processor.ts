import sharp from "sharp";

interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

const DEFAULT_OPTIONS: ImageCompressionOptions = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 85,
};

/**
 * 이미지를 압축하고 Base64로 인코딩합니다
 * 클라이언트 사이드 전송용
 */
export async function compressImageToBase64(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // 파일을 Buffer로 읽기
  const buffer = await file.arrayBuffer();

  // 이미지 압축
  let compressed = sharp(buffer);

  // 메타데이터 확인
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;

  // 리사이즈 필요 여부 확인
  if (width > (opts.maxWidth || 1920) || height > (opts.maxHeight || 1920)) {
    compressed = compressed.resize(opts.maxWidth || 1920, opts.maxHeight || 1920, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  // JPEG로 압축 (토큰 절약)
  const jpeg = await compressed.jpeg({ quality: opts.quality || 85 }).toBuffer();

  // Base64 인코딩
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

/**
 * 여러 이미지를 배치로 압축합니다
 */
export async function compressImagesInBatch(
  files: File[],
  options: ImageCompressionOptions = {}
): Promise<string[]> {
  return Promise.all(files.map((file) => compressImageToBase64(file, options)));
}

/**
 * Base64 데이터의 크기를 추정합니다 (토큰 계산용)
 * Base64는 원본 대비 약 1.33배 크기
 */
export function estimateBase64Size(base64: string): number {
  return Math.ceil((base64.length * 3) / 4);
}

/**
 * 여러 이미지의 총 토큰 비용을 추정합니다
 */
export function estimateImageTokenCost(images: string[]): number {
  // GPT-4o-mini 이미지 토큰 계산
  // detail: "low" = 85 tokens
  // detail: "high" = 170 tokens + 30 per tile
  const baseTokens = 85; // detail: "low"
  return images.length * baseTokens;
}

/**
 * 클라이언트 사이드에서 이미지 압축 전 검증
 */
export function validateImageBeforeCompression(file: File): { valid: boolean; error?: string } {
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return { valid: false, error: "파일 크기가 너무 큽니다 (최대 10MB)" };
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: "지원하지 않는 이미지 형식입니다" };
  }

  return { valid: true };
}

/**
 * 이미지 파일을 읽고 Base64로 변환합니다
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("파일을 읽을 수 없습니다"));
      }
    };
    reader.onerror = () => {
      reject(reader.error);
    };
    reader.readAsDataURL(file);
  });
}
