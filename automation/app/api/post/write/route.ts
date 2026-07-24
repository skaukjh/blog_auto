export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import type { WritePostRequest, WritePostResponse } from '@/types/index';
import NaverBlogAutomation from '@/lib/naver/blog-automation';
import { writePostSequentially } from '@/lib/naver/post-writer';

/** 타이핑이 워낙 오래 걸려 라우트 타임아웃을 넉넉히 둡니다 */
export const maxDuration = 3600;

/** 실수로 과금·차단을 부를 만큼 긴 글을 막습니다 */
const MAX_CONTENT_LENGTH = 10000;

/** 너무 빠른 입력은 사람처럼 보이지 않습니다 */
const MIN_CHAR_DELAY_MS = 25;

function errorResponse(
  message: string,
  status: number,
  startedAt: string
): NextResponse<WritePostResponse> {
  return NextResponse.json(
    {
      success: false,
      typedChars: 0,
      elapsedMs: 0,
      published: false,
      warnings: [],
      startedAt,
      completedAt: new Date().toISOString(),
      error: message,
    },
    { status }
  );
}

/**
 * POST /api/post/write
 *
 * 완성된 글을 네이버 글쓰기 화면에 사람처럼 순차 입력합니다.
 * 기본값은 발행하지 않고 에디터를 열어 둔 채 끝냅니다.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<WritePostResponse>> {
  const startedAt = new Date().toISOString();

  // 로컬 환경만 허용 (다른 API와 동일한 규칙)
  const isLocal = process.env.NODE_ENV === 'development' && !process.env.VERCEL;
  if (!isLocal) {
    return errorResponse('이 기능은 로컬 개발 환경에서만 사용 가능합니다.', 403, startedAt);
  }

  const automation = new NaverBlogAutomation();

  try {
    const body: WritePostRequest = await request.json();
    const {
      blogId,
      blogPassword,
      title,
      content,
      charDelayMs = 55,
      stripImageMarkers = false,
      autoPublish = false,
    } = body;

    if (!blogId || !blogPassword) {
      return errorResponse('블로그 ID와 비밀번호가 필요합니다.', 400, startedAt);
    }
    if (!title?.trim()) {
      return errorResponse('제목이 필요합니다.', 400, startedAt);
    }
    if (!content?.trim()) {
      return errorResponse('본문이 필요합니다.', 400, startedAt);
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      return errorResponse(
        `본문이 너무 깁니다 (${content.length}자 / 최대 ${MAX_CONTENT_LENGTH}자).`,
        400,
        startedAt
      );
    }

    const safeDelay = Math.max(MIN_CHAR_DELAY_MS, charDelayMs);

    await automation.login(blogId, blogPassword);

    const result = await writePostSequentially(automation.getPage(), blogId, {
      title,
      content,
      charDelayMs: safeDelay,
      stripImageMarkers,
      autoPublish,
    });

    // 발행까지 마쳤을 때만 브라우저를 닫습니다.
    // 발행하지 않았다면 사람이 검토해야 하므로 창을 그대로 둡니다.
    if (result.published) {
      await automation.close();
    }

    return NextResponse.json(
      {
        ...result,
        startedAt,
        completedAt: new Date().toISOString(),
      },
      { status: result.success ? 200 : 500 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';

    // 로그인 등 초기 단계에서 실패하면 브라우저를 정리합니다.
    await automation.close();

    return errorResponse(message, 500, startedAt);
  }
}
