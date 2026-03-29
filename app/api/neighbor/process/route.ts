import { NextRequest, NextResponse } from 'next/server';
import { processNeighborAutoLike } from '@/lib/naver/blog-automation';

/**
 * 네이버 블로그 이웃 자동 좋아요 API
 * 로컬 개발 환경에서만 작동
 *
 * 요청 형식:
 * POST /api/neighbor/process
 * {
 *   "blogId": "user_blog_id",
 *   "blogPassword": "password",
 *   "daysLimit": 7,
 *   "maxNeighbors": 10
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // ⚠️ 로컬 환경만 허용
    const isLocal = process.env.NODE_ENV === 'development' && !process.env.VERCEL;

    if (!isLocal) {
      return NextResponse.json(
        {
          success: false,
          error: '이 기능은 로컬 개발 환경에서만 사용 가능합니다.',
          message: 'npm run dev로 로컬 서버를 실행하세요.',
        },
        { status: 403 }
      );
    }

    // 요청 바디 파싱
    const body = await request.json();
    const { blogId, blogPassword, daysLimit = 7, maxNeighbors = 10 } = body;

    // 입력값 검증
    if (!blogId || !blogPassword) {
      return NextResponse.json(
        {
          success: false,
          error: '블로그 ID와 비밀번호를 입력하세요.',
          totalProcessed: 0,
          totalLiked: 0,
          neighborStats: [],
          errors: ['입력값 누락'],
        },
        { status: 400 }
      );
    }

    if (typeof blogId !== 'string' || typeof blogPassword !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: '입력값 형식이 올바르지 않습니다.',
          totalProcessed: 0,
          totalLiked: 0,
          neighborStats: [],
          errors: ['형식 오류'],
        },
        { status: 400 }
      );
    }

    console.log('\n========== 네이버 블로그 이웃 자동 좋아요 시작 ==========');
    console.log(`시간: ${new Date().toLocaleString('ko-KR')}`);
    console.log(`블로그 ID: ${blogId}`);
    console.log(`일 제한: ${daysLimit}일 이내`);
    console.log(`이웃 제한: 최대 ${maxNeighbors}명`);
    console.log('======================================================\n');

    // 처리 시작 (타임아웃 설정: 10분)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000);

    try {
      const result = await processNeighborAutoLike(blogId, blogPassword, daysLimit, maxNeighbors);

      clearTimeout(timeoutId);

      console.log('\n========== 처리 결과 ==========');
      console.log(`성공: ${result.success}`);
      console.log(`처리된 글: ${result.totalProcessed}개`);
      console.log(`좋아요 완료: ${result.totalLiked}개`);
      console.log(`소요 시간: ${new Date(result.completedAt).getTime() - new Date(result.startedAt).getTime()}ms`);
      console.log('==============================\n');

      return NextResponse.json(result);
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';

    console.error('\n========== 오류 발생 ==========');
    console.error(`오류: ${errorMessage}`);
    console.error('==============================\n');

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        totalProcessed: 0,
        totalLiked: 0,
        neighborStats: [],
        errors: [errorMessage],
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
