import { NextRequest, NextResponse } from 'next/server';

/**
 * 네이버 블로그 홈 이웃새글 일괄 좋아요 API
 * 로컬 개발 환경에서만 작동
 *
 * 요청 형식:
 * POST /api/neighbor/like-home
 * {
 *   "blogId": "user_blog_id",
 *   "blogPassword": "password"
 * }
 */

// 클라이언트에서 실행할 Playwright 자동화 함수
async function autoLikeNeighborPostsWithPlaywright(blogId: string, blogPassword: string) {
  const { chromium } = await import('playwright');

  let browser = null;
  const details: Array<{
    page: number;
    title: string;
    liked: boolean;
    reason?: string;
  }> = [];

  try {
    // 브라우저 시작
    browser = await chromium.launch({
      headless: false,
      args: ['--disable-blink-features=AutomationControlled'],
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(30000);

    // 로그인
    console.log('[Browser] 네이버 로그인 중...');
    await page.goto('https://nid.naver.com/nidlogin.login', {
      waitUntil: 'domcontentloaded',
    });

    await page.locator('input[name="id"]').fill(blogId);
    await page.waitForTimeout(500);
    await page.locator('input[name="pw"]').fill(blogPassword);
    await page.waitForTimeout(500);

    const loginButton = await page.locator('button:has-text("로그인")').first();
    await loginButton.click();

    // 로그인 완료 대기
    console.log('[Browser] 로그인 완료 대기 중...');
    let loginSuccess = false;
    for (let i = 0; i < 120; i++) {
      const url = page.url();
      if (!url.includes('nid.naver.com/nidlogin.login')) {
        loginSuccess = true;
        break;
      }
      await page.waitForTimeout(1000);
    }

    if (!loginSuccess) {
      throw new Error('로그인에 실패했습니다. ID/PW를 확인하세요.');
    }

    // 이웃새글 홈으로 이동
    console.log('[Browser] 이웃새글 홈으로 이동 중...');
    await page.goto(
      'https://section.blog.naver.com/BlogHome.naver?directoryNo=0&currentPage=1&groupId=0',
      { waitUntil: 'domcontentloaded' }
    );
    await page.waitForTimeout(2000);

    // 페이지별 처리 (URL의 currentPage 파라미터로 직접 제어)
    const startTime = new Date();
    let currentPageNum = 1;
    let totalProcessed = 0;
    let totalLiked = 0;
    let hasNextPage = true;

    while (hasNextPage && currentPageNum <= 100) {
      console.log(`\n========== 페이지 ${currentPageNum} 처리 ==========`);

      // URL의 currentPage 파라미터를 증가시키면서 직접 이동
      const pageUrl = `https://section.blog.naver.com/BlogHome.naver?directoryNo=0&currentPage=${currentPageNum}&groupId=0`;
      console.log(`[이동] ${pageUrl}`);

      try {
        await page.goto(pageUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 20000,
        });

        // 페이지 로드 완료 대기
        await page.waitForTimeout(1500);
      } catch (err) {
        console.log(`[오류] 페이지 로드 실패: ${err}`);
        hasNextPage = false;
        break;
      }

      // 좋아요 버튼 모두 찾기
      const likeButtonLocators = await page.locator('a.u_likeit_button._face').all();
      console.log(`찾은 좋아요 버튼: ${likeButtonLocators.length}개`);

      if (likeButtonLocators.length === 0) {
        console.log('[종료] 좋아요 버튼을 찾을 수 없습니다');
        break;
      }

      // 각 버튼마다 개별 처리
      for (let i = 0; i < likeButtonLocators.length; i++) {
        const buttonLocator = likeButtonLocators[i];

        try {
          // 현재 상태 확인
          const ariaPressed = await buttonLocator.getAttribute('aria-pressed');
          const isAlreadyLiked = ariaPressed === 'true';

          // 제목 추출 - 페이지 전체 스냅샷으로 상태 조회
          let title = `글 #${i + 1}`;

          try {
            // 방법 1: 버튼의 부모 요소들을 따라올라가면서 제목 찾기
            let currentElement = buttonLocator;
            let attempts = 0;
            const maxAttempts = 10;

            while (attempts < maxAttempts) {
              try {
                // 현재 요소에서 strong 찾기 (제목)
                const titleElement = await currentElement.locator('strong').first();
                const titleText = await titleElement.textContent();

                if (titleText && titleText.trim().length > 2 && titleText.trim().length < 150) {
                  title = titleText.trim();
                  break;
                }

                // 부모로 이동
                currentElement = currentElement.locator('..');
                attempts++;
              } catch (e) {
                break;
              }
            }

            // 방법 2: strong으로 못 찾으면 a 태그 찾기
            if (title === `글 #${i + 1}`) {
              try {
                const linkElement = await buttonLocator.locator('xpath=ancestor::article//a[1] | ancestor::li//a[1] | ancestor::div[@class*="item"]//a[1]').first();
                const linkText = await linkElement.textContent();

                if (linkText && linkText.trim().length > 2 && linkText.trim().length < 150) {
                  title = linkText.trim();
                }
              } catch (e) {
                // 계속 진행
              }
            }
          } catch (e) {
            // 에러 무시, 기본값 사용
            console.log(`제목 추출 오류 [${i + 1}]:`, (e as Error).message);
          }

          totalProcessed++;
          console.log(`[${currentPageNum}-${i + 1}] "${title}" - 상태: ${isAlreadyLiked ? '✅이미좋아요' : '⭕미처리'}`);

          if (isAlreadyLiked) {
            details.push({
              page: currentPageNum,
              title: title.trim(),
              liked: false,
              reason: '이미 좋아요됨',
            });
          } else {
            // 좋아요 클릭
            await buttonLocator.click();
            console.log(`[${currentPageNum}-${i + 1}] 클릭 완료`);

            // 페이지 안정화 대기
            await page.waitForTimeout(600);

            // 클릭 후 상태 재확인
            const newAriaPressed = await buttonLocator.getAttribute('aria-pressed');
            const likeSucceeded = newAriaPressed === 'true';

            if (likeSucceeded) {
              totalLiked++;
              console.log(`[${currentPageNum}-${i + 1}] ✅ 좋아요 성공`);
              details.push({
                page: currentPageNum,
                title: title.trim(),
                liked: true,
              });
            } else {
              console.log(`[${currentPageNum}-${i + 1}] ❌ 좋아요 미적용`);
              details.push({
                page: currentPageNum,
                title: title.trim(),
                liked: false,
                reason: '클릭 후에도 상태 미변경',
              });
            }
          }
        } catch (err) {
          console.log(`[${currentPageNum}-${i + 1}] 오류: ${err}`);
          details.push({
            page: currentPageNum,
            title: `[오류 발생 #${i + 1}]`,
            liked: false,
            reason: err instanceof Error ? err.message : '처리 실패',
          });
        }
      }

      // 다음 페이지로 이동할 준비 (currentPage 파라미터 증가)
      console.log(`\n[Page ${currentPageNum}] 다음 페이지로 이동 준비...`);

      // 다음 페이지 로드를 위해 currentPageNum 증가
      // 만약 다음 페이지에 좋아요 버튼이 없으면 루프가 종료됨
      currentPageNum++;
      console.log(`[진행] 페이지 ${currentPageNum}로 이동 예정...`);
    }

    const endTime = new Date();

    return {
      success: true,
      totalPages: currentPageNum,
      totalProcessed,
      totalLiked,
      totalFailed: details.filter((d) => !d.liked && d.reason !== '이미 좋아요됨').length,
      startedAt: startTime.toISOString(),
      completedAt: endTime.toISOString(),
      details,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    // ⚠️ 로컬 환경만 허용
    const isLocal = process.env.NODE_ENV === 'development' && !process.env.VERCEL;

    if (!isLocal) {
      return NextResponse.json(
        {
          success: false,
          error: '이 기능은 로컬 개발 환경에서만 사용 가능합니다.',
          totalPages: 0,
          totalProcessed: 0,
          totalLiked: 0,
          totalFailed: 0,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          details: [],
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { blogId, blogPassword } = body;

    if (!blogId || !blogPassword) {
      return NextResponse.json(
        {
          success: false,
          error: '블로그 ID와 비밀번호를 입력하세요.',
          totalPages: 0,
          totalProcessed: 0,
          totalLiked: 0,
          totalFailed: 0,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          details: [],
        },
        { status: 400 }
      );
    }

    console.log('\n========== 네이버 블로그 이웃새글 일괄 좋아요 시작 ==========');
    console.log(`시간: ${new Date().toLocaleString('ko-KR')}`);
    console.log('=========================================================\n');

    const timeoutId = setTimeout(() => {
      throw new Error('처리 시간 초과 (30분)');
    }, 30 * 60 * 1000);

    try {
      const result = await autoLikeNeighborPostsWithPlaywright(blogId, blogPassword);

      clearTimeout(timeoutId);

      console.log('\n========== 처리 완료 ==========');
      console.log(`성공: ${result.success}`);
      console.log(`처리 페이지: ${result.totalPages}개`);
      console.log(`처리된 글: ${result.totalProcessed}개`);
      console.log(`좋아요 완료: ${result.totalLiked}개`);
      console.log(`실패: ${result.totalFailed}개`);
      console.log('================================\n');

      return NextResponse.json(result);
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';

    console.error('\n========== 오류 발생 ==========');
    console.error(`오류: ${errorMessage}`);
    console.error('================================\n');

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        totalPages: 0,
        totalProcessed: 0,
        totalLiked: 0,
        totalFailed: 0,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        details: [],
      },
      { status: 500 }
    );
  }
}
