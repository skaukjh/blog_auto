export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import type {
  NeighborCommentRequest,
  NeighborCommentResult,
} from '@/types/index';
import NaverBlogAutomation from '@/lib/naver/blog-automation';

/**
 * 네이버 블로그 이웃새글에 댓글과 좋아요 자동 달기
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<NeighborCommentResult>> {
  try {
    // 로컬 환경만 허용
    const isLocal =
      process.env.NODE_ENV === 'development' &&
      !process.env.VERCEL;
    if (!isLocal) {
      return NextResponse.json(
        {
          success: false,
          error: '이 기능은 로컬 개발 환경에서만 사용 가능합니다.',
          totalProcessed: 0,
          totalCommented: 0,
          totalLiked: 0,
          totalSkipped: 0,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          details: [],
        },
        { status: 403 }
      );
    }

    const body: NeighborCommentRequest = await request.json();
    const {
      blogId,
      blogPassword,
      maxPosts = 5,
      minInterval = 3,
      keepLikingAfter = false,
    } = body;

    // 입력값 검증
    if (!blogId || !blogPassword) {
      return NextResponse.json(
        {
          success: false,
          error: '블로그 ID와 비밀번호가 필요합니다.',
          totalProcessed: 0,
          totalCommented: 0,
          totalLiked: 0,
          totalSkipped: 0,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          details: [],
        },
        { status: 400 }
      );
    }

    // maxPosts 제한 (최대 10개)
    const limitedMaxPosts = Math.min(maxPosts, 10);

    // Playwright 자동화 실행
    const automation = new NaverBlogAutomation();
    const result = await automation.autoCommentAndLikeNeighborPosts(
      blogId,
      blogPassword,
      limitedMaxPosts,
      minInterval,
      keepLikingAfter
    );

    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : '알 수 없는 오류';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        totalProcessed: 0,
        totalCommented: 0,
        totalLiked: 0,
        totalSkipped: 0,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        details: [],
      },
      { status: 500 }
    );
  }
}
