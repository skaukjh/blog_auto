import { z } from "zod";

// 로그인 검증
export const loginSchema = z.object({
  password: z.string().min(1, "비밀번호를 입력해주세요"),
});

export type LoginInput = z.infer<typeof loginSchema>;

// 이미지 파일 검증
export const validateImageFile = (file: File): boolean => {
  // 파일 크기 체크 (최대 10MB)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return false;
  }

  // 이미지 형식 체크
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    return false;
  }

  return true;
};

// 이미지 배열 검증
export const validateImages = (files: File[]): { valid: boolean; error?: string } => {
  if (files.length === 0) {
    return { valid: false, error: "최소 1장 이상의 이미지를 업로드해주세요" };
  }

  if (files.length > 25) {
    return { valid: false, error: "최대 25장까지만 업로드 가능합니다" };
  }

  for (const file of files) {
    if (!validateImageFile(file)) {
      return {
        valid: false,
        error: "지원하지 않는 이미지 형식 또는 파일 크기(최대 10MB)를 초과했습니다",
      };
    }
  }

  return { valid: true };
};

// 폼 데이터 검증
export const generateFormSchema = z.object({
  topic: z.string().min(2, "주제는 최소 2글자 이상이어야 합니다").max(100, "주제는 100글자 이하여야 합니다"),
  length: z.enum(["short", "medium", "long"]),
  keywords: z.array(
    z.object({
      text: z.string().min(1, "키워드는 최소 1글자 이상이어야 합니다").max(50, "키워드는 50글자 이하여야 합니다"),
      count: z.number().int().min(1, "개수는 최소 1개 이상이어야 합니다").max(10, "개수는 최대 10개까지 가능합니다"),
    })
  ),
  startSentence: z.string().max(200, "시작 문장은 200글자 이하여야 합니다").optional(),
  endSentence: z.string().max(200, "마무리 문장은 200글자 이하여야 합니다").optional(),
});

export type GenerateFormInput = z.infer<typeof generateFormSchema>;

// 키워드 검증
export const validateKeywords = (keywords: { text: string; count: number }[]): { valid: boolean; error?: string } => {
  if (keywords.length === 0) {
    return { valid: false, error: "최소 1개의 키워드를 입력해주세요" };
  }

  if (keywords.length > 10) {
    return { valid: false, error: "최대 10개의 키워드까지만 입력 가능합니다" };
  }

  const uniqueKeywords = new Set(keywords.map((k) => k.text.toLowerCase()));
  if (uniqueKeywords.size !== keywords.length) {
    return { valid: false, error: "중복된 키워드가 있습니다" };
  }

  return { valid: true };
};

// URL 검증
export const validateUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// 비밀번호 검증
export const validatePassword = (password: string): boolean => {
  const correctPassword = process.env.AUTH_PASSWORD || "wogns0513@";
  return password === correctPassword;
};
