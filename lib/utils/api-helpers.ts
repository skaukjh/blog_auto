import { NextResponse } from 'next/server';

/**
 * API 응답 헬퍼 함수
 * Phase 22: 에러 응답 통합
 */

/**
 * 성공 응답 생성
 */
export function createSuccessResponse<T extends Record<string, any>>(
  data: T,
  status: number = 200
): NextResponse<T & { success: true }> {
  return NextResponse.json(
    {
      ...data,
      success: true,
    } as T & { success: true },
    { status }
  );
}

/**
 * 에러 응답 생성
 */
export function createErrorResponse<T extends Record<string, any>>(
  error: string | Error,
  defaultData: T,
  status: number = 500
): NextResponse<T & { success: false; error: string }> {
  const errorMessage = error instanceof Error ? error.message : String(error);

  return NextResponse.json(
    {
      ...defaultData,
      success: false,
      error: errorMessage,
    } as T & { success: false; error: string },
    { status }
  );
}

/**
 * 검증 에러 응답 생성
 */
export function createValidationError<T extends Record<string, any>>(
  error: string,
  defaultData: T
): NextResponse<T & { success: false; error: string }> {
  return createErrorResponse(error, defaultData, 400);
}

/**
 * 권한 없음 에러 응답
 */
export function createUnauthorizedError<T extends Record<string, any>>(
  error: string = '인증이 필요합니다',
  defaultData: T
): NextResponse<T & { success: false; error: string }> {
  return createErrorResponse(error, defaultData, 401);
}

/**
 * 찾을 수 없음 에러 응답
 */
export function createNotFoundError<T extends Record<string, any>>(
  error: string = '리소스를 찾을 수 없습니다',
  defaultData: T
): NextResponse<T & { success: false; error: string }> {
  return createErrorResponse(error, defaultData, 404);
}

/**
 * 너무 많은 요청 에러 응답
 */
export function createRateLimitError<T extends Record<string, any>>(
  error: string = '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
  defaultData: T
): NextResponse<T & { success: false; error: string }> {
  return createErrorResponse(error, defaultData, 429);
}

/**
 * 에러 로깅 (민감한 정보 제거)
 */
export function logError(context: string, error: unknown): void {
  if (error instanceof Error) {
    console.error(`[${context}] ${error.message}`);
  } else {
    console.error(`[${context}] Unknown error:`, String(error));
  }
}
