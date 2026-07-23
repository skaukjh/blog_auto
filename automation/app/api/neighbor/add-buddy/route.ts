import { NextRequest, NextResponse } from 'next/server';

/**
 * 네이버 블로그 서로이웃 자동 추가 API
 * 로컬 개발 환경에서만 작동
 *
 * 요청 형식:
 * POST /api/neighbor/add-buddy
 * {
 *   "blogId": "user_blog_id",
 *   "blogPassword": "password",
 *   "maxCount": 10,
 *   "groupName": "보안과 해킹",
 *   "greetingMessage": "안녕하세요! 이웃 신청합니다."
 * }
 */

export interface BuddyAddResult {
  success: boolean;
  totalProcessed: number;
  totalAdded: number;
  totalFailed: number;
  totalSkipped: number;
  startedAt: string;
  completedAt: string;
  details: Array<{
    index: number;
    blogId?: string;
    added: boolean;
    reason?: string;
  }>;
  error?: string;
}

async function addBuddiesWithPlaywright(
  blogId: string,
  blogPassword: string,
  maxCount: number,
  groupName: string,
  greetingMessage: string
): Promise<BuddyAddResult> {
  const { chromium } = await import('playwright');

  const startedAt = new Date().toISOString();
  const details: BuddyAddResult['details'] = [];
  let totalAdded = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  let totalProcessed = 0;

  let browser = null;

  try {
    // 브라우저 시작
    browser = await chromium.launch({
      headless: false,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
      ],
    });

    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);

    // 팝업 페이지 추적용
    let buddyPopupPage: any = null;

    // 1단계: 네이버 로그인
    console.log('[서로이웃] 네이버 로그인 중...');
    await page.goto('https://nid.naver.com/nidlogin.login', {
      waitUntil: 'domcontentloaded',
    });

    await page.locator('input[name="id"]').fill(blogId);
    await page.waitForTimeout(500);
    await page.locator('input[name="pw"]').fill(blogPassword);
    await page.waitForTimeout(500);

    const loginButton = await page.locator('button:has-text("로그인")').first();
    await loginButton.click();

    // 로그인 완료 대기 (최대 2분, 2차 인증 고려)
    console.log('[서로이웃] 로그인 완료 대기 중... (2차 인증 시 직접 처리)');
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
      throw new Error('로그인 실패: 아이디 또는 비밀번호를 확인하세요.');
    }

    await page.waitForTimeout(2000);
    console.log('[서로이웃] 로그인 성공');

    // 2단계: 이웃새글 홈 이동
    // 그룹명이 있으면 드롭다운 항목의 현재 선택 텍스트로 groupId를 찾아 URL에 반영
    // (URL에 groupId를 직접 지정하면 해피빈 광고 배너 클릭 방해 문제 없이 그룹 필터 적용됨)
    console.log('[서로이웃] 이웃새글 홈 이동 중...');
    await page.goto(
      'https://section.blog.naver.com/BlogHome.naver?directoryNo=0&currentPage=1&groupId=0',
      { waitUntil: 'domcontentloaded' }
    );
    await page.waitForTimeout(2000);

    // 3단계: 그룹 선택 - JavaScript evaluate로 직접 클릭 (해피빈 배너 우회)
    if (groupName) {
      console.log(`[서로이웃] 그룹 "${groupName}" 선택 중...`);

      try {
        // 드롭다운을 JS로 직접 열기 (해피빈 배너가 pointer events를 가로채므로)
        const opened = await page.evaluate(() => {
          const btn = document.querySelector(
            'a.present_selected._buddy_dropdown_menu, a._buddy_dropdown_menu'
          ) as HTMLElement;
          if (btn) { btn.click(); return true; }
          return false;
        });
        console.log(`[서로이웃] 드롭다운 JS 클릭: ${opened}`);
        await page.waitForTimeout(1000);

        // 그룹 목록에서 텍스트 일치 항목 JS로 클릭
        const groupFound = await page.evaluate((name: string) => {
          const items = document.querySelectorAll(
            'a[role="menuitem"].item, .dropdown_select a.item'
          );
          for (const item of Array.from(items)) {
            if ((item as HTMLElement).textContent?.trim() === name) {
              (item as HTMLElement).click();
              return true;
            }
          }
          return false;
        }, groupName);

        if (groupFound) {
          console.log(`[서로이웃] 그룹 "${groupName}" 선택 완료`);
          await page.waitForTimeout(2000);
        } else {
          console.log(`[서로이웃] 그룹 "${groupName}"을 찾지 못했습니다. 전체 목록으로 진행합니다.`);
        }
      } catch (err) {
        console.log('[서로이웃] 그룹 선택 실패, 전체 목록으로 진행:', err);
      }
    }

    // 4~11단계: 페이지별 이웃추가 버튼 클릭 및 서로이웃 신청
    let currentPage = 1;

    while (totalAdded < maxCount && currentPage <= 50) {
      console.log(`\n[서로이웃] === 페이지 ${currentPage} 처리 중 ===`);

      // 현재 페이지의 이웃추가 버튼 목록 추출
      const addButtons = await page.locator(
        '#content > section > div.list_post_article a.button_buddy.button_buddy_add'
      ).all();

      console.log(`[서로이웃] 이웃추가 버튼: ${addButtons.length}개`);

      if (addButtons.length === 0) {
        console.log('[서로이웃] 이웃추가 버튼이 없습니다. 종료.');
        break;
      }

      // 각 이웃추가 버튼 처리
      for (let i = 0; i < addButtons.length; i++) {
        if (totalAdded >= maxCount) break;

        const btn = addButtons[i];

        // 팝업에서 확인한 실제 blogId (catch 블록에서도 참조 가능하도록 바깥에 선언)
        let actualBlogId = `unknown_${i + 1}`;

        try {
          // 버튼에서 blogId 추출 (href 또는 data 속성에서)
          const btnHref = await btn.getAttribute('href');
          const btnOnclick = await btn.getAttribute('onclick');
          const targetBlogId = btnHref?.match(/blogId=([^&]+)/)?.[1]
            || btnOnclick?.match(/blogId=([^&'"]+)/)?.[1]
            || `unknown_${i + 1}`;

          console.log(`\n[서로이웃] [${totalProcessed + 1}] blogId: ${targetBlogId}`);

          totalProcessed++;

          // 팝업 열기 감지 준비
          const popupPromise = context.waitForEvent('page', { timeout: 10000 }).catch(() => null);

          // 이웃추가 버튼 클릭
          await btn.click();
          console.log(`[서로이웃] 버튼 클릭 완료`);

          // 팝업 페이지 대기
          buddyPopupPage = await popupPromise;

          if (!buddyPopupPage) {
            // 팝업이 없으면 새 탭에서 직접 URL 열기 시도
            console.log('[서로이웃] 팝업이 없습니다. URL에서 직접 시도...');

            if (btnHref && btnHref.includes('BuddyAdd')) {
              buddyPopupPage = await context.newPage();
              await buddyPopupPage.goto(btnHref, { waitUntil: 'domcontentloaded' });
            } else if (targetBlogId !== `unknown_${i + 1}`) {
              buddyPopupPage = await context.newPage();
              await buddyPopupPage.goto(
                `https://blog.naver.com/buddy/BuddyAdd.naver?blogId=${targetBlogId}`,
                { waitUntil: 'domcontentloaded' }
              );
            } else {
              throw new Error('팝업 열기 실패: 유효한 URL을 찾을 수 없습니다');
            }
          }

          await buddyPopupPage.waitForLoadState('domcontentloaded');
          await page.waitForTimeout(2000);

          // 팝업 URL에서 실제 blogId 추출 (outer 변수 갱신)
          const popupUrl = buddyPopupPage.url();
          actualBlogId = popupUrl.match(/blogId=([^&]+)/)?.[1] || targetBlogId;
          console.log(`[서로이웃] 팝업 URL: ${popupUrl}`);
          console.log(`[서로이웃] 대상 blogId: ${actualBlogId}`);

          // 특정 선택자로 안내 문구 확인 (전체 HTML 검색 대신 정확한 노드만 확인)
          const noticeText = await buddyPopupPage.evaluate(() => {
            // 서로이웃 불가 안내 문구 선택자
            const noticeEl = document.querySelector(
              '#content > div > form > fieldset > div.popup_text > div.buddy_state > p.notice'
            );
            return noticeEl ? noticeEl.textContent?.trim() || '' : '';
          });

          console.log(`[서로이웃] 안내 문구: "${noticeText}"`);

          // 서로이웃 신청을 받지 않는 경우 → 건너뜀 (카운트 미포함)
          if (noticeText.includes('서로이웃 신청을 받지 않는')) {
            console.log('[서로이웃] 서로이웃 신청을 받지 않는 이웃입니다. 건너뜁니다.');
            totalSkipped++;
            details.push({
              index: totalProcessed,
              blogId: actualBlogId,
              added: false,
              reason: '서로이웃 신청을 받지 않는 이웃',
            });
            await buddyPopupPage.close().catch(() => {});
            buddyPopupPage = null;
            await page.waitForTimeout(1000);
            continue;
          }

          // 이미 이웃인 경우 → 건너뜀 (카운트 미포함)
          const alreadyBuddy = await buddyPopupPage.evaluate(() => {
            const el = document.querySelector('#content > div > form > fieldset > div.popup_text > div.buddy_state > p.notice');
            const text = el?.textContent?.trim() || '';
            return text.includes('이미 이웃') || text.includes('이웃 신청 중');
          });

          if (alreadyBuddy) {
            console.log('[서로이웃] 이미 이웃 또는 신청 중 상태입니다. 건너뜁니다.');
            totalSkipped++;
            details.push({
              index: totalProcessed,
              blogId: actualBlogId,
              added: false,
              reason: '이미 이웃 또는 신청 중',
            });
            await buddyPopupPage.close().catch(() => {});
            buddyPopupPage = null;
            await page.waitForTimeout(1000);
            continue;
          }

          // 6단계: "서로이웃으로 신청합니다." 라디오 버튼 선택
          // label[for="each_buddy_add"] 클릭 (label이 pointer events를 가로채므로)
          console.log('[서로이웃] 서로이웃 라디오 버튼(label) 클릭...');
          try {
            const radioLabel = buddyPopupPage.locator('label[for="each_buddy_add"]').first();
            const labelCount = await radioLabel.count();

            if (labelCount > 0) {
              await radioLabel.click();
              await page.waitForTimeout(800);
            } else {
              // label이 없으면 JavaScript로 직접 선택
              await buddyPopupPage.evaluate(() => {
                const radio = document.querySelector('#each_buddy_add') as HTMLInputElement;
                if (radio) {
                  radio.checked = true;
                  radio.dispatchEvent(new Event('change', { bubbles: true }));
                  radio.dispatchEvent(new Event('click', { bubbles: true }));
                }
              });
              await page.waitForTimeout(800);
            }

            // checked 상태 확인
            const isChecked = await buddyPopupPage.evaluate(() => {
              const radio = document.querySelector('#each_buddy_add') as HTMLInputElement;
              const wrapper = document.querySelector('.wrap_radio.radio_bothbuddy');
              return {
                radioChecked: radio?.checked || false,
                wrapperHasChecked: wrapper?.classList.contains('checked') || false,
              };
            });
            console.log(`[서로이웃] 라디오 상태: ${JSON.stringify(isChecked)}`);
          } catch (radioErr) {
            console.log('[서로이웃] 라디오 버튼 클릭 실패, 계속 진행:', radioErr);
          }

          // 7단계: 다음 버튼 클릭 (팝업 내부 페이지 전환 대기)
          console.log('[서로이웃] 첫번째 다음 버튼 클릭...');
          const nextBtn1 = buddyPopupPage.locator(
            '#content > div > form > fieldset > div.area_button > a.button_next._buddyAddNext'
          ).first();
          // 클릭과 동시에 팝업 내 네비게이션 완료를 기다림
          await Promise.all([
            buddyPopupPage.waitForLoadState('domcontentloaded').catch(() => {}),
            nextBtn1.click().catch(() => {}),
          ]);
          await page.waitForTimeout(1500);

          // 8단계: 페이지 전환 확인
          const afterNextUrl = buddyPopupPage.url();
          console.log(`[서로이웃] 전환 후 URL: ${afterNextUrl}`);

          // 9단계: 팝업 상태 확인 - 첫번째 버튼 후 팝업이 닫혔으면 신청 실패
          if (buddyPopupPage.isClosed()) {
            console.log('[서로이웃] ⚠️ 첫번째 다음 버튼 후 팝업이 자동 닫힘 - 신청 미완료로 처리');
            totalFailed++;
            details.push({
              index: totalProcessed,
              blogId: actualBlogId,
              added: false,
              reason: '팝업 자동 닫힘 (신청 미완료)',
            });
            buddyPopupPage = null;
            await page.waitForTimeout(1000);
            continue;
          }

          // 인사말 입력 (팝업이 살아있는 경우만)
          console.log('[서로이웃] 인사말 입력 중...');
          try {
            const hasMessage = await buddyPopupPage.evaluate(
              () => !!document.querySelector('#message')
            ).catch(() => false);

            if (hasMessage) {
              const messageInput = buddyPopupPage.locator('#message').first();
              await messageInput.fill(greetingMessage).catch(() => {});
              await page.waitForTimeout(500);
              console.log('[서로이웃] 인사말 입력 완료');
            } else {
              console.log('[서로이웃] #message 요소 없음 - 인사말 입력 생략');
            }
          } catch (msgErr) {
            console.log('[서로이웃] 인사말 입력 실패, 계속 진행:', msgErr);
          }

          // 10단계: 두 번째 다음 버튼 클릭 (신청 제출)
          console.log('[서로이웃] 두번째 다음 버튼 클릭...');
          const nextBtn2 = buddyPopupPage.locator('a.button_next._addBothBuddy').first();
          await nextBtn2.click().catch(() => {});
          await page.waitForTimeout(2000);

          // 11단계: 완료 처리 - 팝업 자동 닫힘(성공) 또는 완료 화면 닫기
          if (buddyPopupPage.isClosed()) {
            // 두번째 버튼 클릭 후 팝업이 자동으로 닫힘 = 신청 완료 후 window.close() 호출됨
            console.log('[서로이웃] 신청 완료 후 팝업 자동 닫힘 (정상)');
          } else {
            // 완료 화면이 표시된 경우 닫기 버튼 클릭
            console.log('[서로이웃] 닫기 버튼 클릭...');
            const closeBtn = buddyPopupPage.locator('#content > div > div.area_button > a').first();
            await closeBtn.click().catch(() => {});
            await buddyPopupPage.close().catch(() => {});
          }

          buddyPopupPage = null;
          // 닫기 후 대기는 팝업이 아닌 메인 페이지에서 수행
          await page.waitForTimeout(1000);

          totalAdded++;
          details.push({
            index: totalProcessed,
            blogId: actualBlogId,
            added: true,
          });

          console.log(`[서로이웃] ✅ 서로이웃 신청 완료 (${totalAdded}/${maxCount})`);

          // 다음 신청 전 대기 (스팸 방지: 10~60초 랜덤, 10초 단위로 남은 시간 표시)
          if (totalAdded < maxCount) {
            const waitSec = Math.floor(Math.random() * 51) + 10; // 10~60초
            console.log(`[서로이웃] 다음 신청까지 ${waitSec}초 대기...`);
            let elapsed = 0;
            while (elapsed < waitSec) {
              const remaining = waitSec - elapsed;
              if (elapsed > 0 && remaining % 10 === 0) {
                console.log(`[서로이웃] 남은 대기 시간: ${remaining}초`);
              }
              const step = Math.min(10, remaining);
              await page.waitForTimeout(step * 1000);
              elapsed += step;
            }
          }
        } catch (err) {
          totalFailed++;
          const errMsg = err instanceof Error ? err.message : '알 수 없는 오류';
          console.log(`[서로이웃] ❌ 오류 발생: ${errMsg}`);

          details.push({
            index: totalProcessed,
            blogId: actualBlogId,
            added: false,
            reason: errMsg,
          });

          // 팝업이 열려있으면 닫기
          if (buddyPopupPage) {
            await buddyPopupPage.close().catch(() => {});
            buddyPopupPage = null;
          }

          await page.waitForTimeout(2000);
        }
      }

      // 다음 페이지로 이동
      if (totalAdded < maxCount) {
        currentPage++;
        console.log(`\n[서로이웃] 다음 페이지(${currentPage})로 이동 중...`);

        try {
          // 페이지 하단 페이지네이션 클릭 시도
          const paginationNext = await page.locator(
            '#content > section > div:nth-child(3) > div a[href*="currentPage"]'
          ).filter({ hasText: `${currentPage}` }).first();

          const paginationExists = await paginationNext.count();

          if (paginationExists > 0) {
            await paginationNext.click();
            await page.waitForTimeout(2000);
          } else {
            // URL 직접 이동
            const nextUrl = `https://section.blog.naver.com/BlogHome.naver?directoryNo=0&currentPage=${currentPage}&groupId=2`;
            await page.goto(nextUrl, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);
          }

          // 이웃추가 버튼이 있는지 확인
          const nextPageBtns = await page.locator(
            '#content > section > div.list_post_article a.button_buddy.button_buddy_add'
          ).count();

          if (nextPageBtns === 0) {
            console.log('[서로이웃] 다음 페이지에 이웃추가 버튼이 없습니다. 종료.');
            break;
          }
        } catch (pageErr) {
          console.log('[서로이웃] 페이지 이동 실패:', pageErr);
          break;
        }
      }
    }

    return {
      success: true,
      totalProcessed,
      totalAdded,
      totalFailed,
      totalSkipped,
      startedAt,
      completedAt: new Date().toISOString(),
      details,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export async function POST(request: NextRequest) {
  // 로컬 환경 체크
  const isLocal = process.env.NODE_ENV === 'development' && !process.env.VERCEL;

  if (!isLocal) {
    return NextResponse.json(
      {
        success: false,
        error: '이 기능은 로컬 개발 환경에서만 사용 가능합니다.',
        totalProcessed: 0,
        totalAdded: 0,
        totalFailed: 0,
        totalSkipped: 0,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        details: [],
      } as BuddyAddResult,
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const {
      blogId,
      blogPassword,
      maxCount = 10,
      groupName = '보안과 해킹',
      greetingMessage = '안녕하세요! 좋은 글 잘 보고 있어요. 서로이웃 신청합니다 :)',
    } = body;

    if (!blogId || !blogPassword) {
      return NextResponse.json(
        {
          success: false,
          error: '블로그 ID와 비밀번호를 입력하세요.',
          totalProcessed: 0,
          totalAdded: 0,
          totalFailed: 0,
          totalSkipped: 0,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          details: [],
        } as BuddyAddResult,
        { status: 400 }
      );
    }

    const count = Math.min(Math.max(1, parseInt(maxCount) || 10), 100);

    console.log('\n========== 서로이웃 자동 추가 시작 ==========');
    console.log(`시간: ${new Date().toLocaleString('ko-KR')}`);
    console.log(`대상 그룹: ${groupName}`);
    console.log(`추가 목표: ${count}명`);
    console.log('=============================================\n');

    const result = await addBuddiesWithPlaywright(
      blogId,
      blogPassword,
      count,
      groupName,
      greetingMessage
    );

    console.log('\n========== 처리 완료 ==========');
    console.log(`총 처리: ${result.totalProcessed}개`);
    console.log(`추가 완료: ${result.totalAdded}개`);
    console.log(`실패: ${result.totalFailed}개`);
    console.log(`건너뜀: ${result.totalSkipped}개`);
    console.log('================================\n');

    return NextResponse.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';

    console.error('\n========== 오류 발생 ==========');
    console.error(`오류: ${errorMessage}`);
    console.error('================================\n');

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        totalProcessed: 0,
        totalAdded: 0,
        totalFailed: 0,
        totalSkipped: 0,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        details: [],
      } as BuddyAddResult,
      { status: 500 }
    );
  }
}
