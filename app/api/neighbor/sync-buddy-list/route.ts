export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import {
  getNeighborTargetList,
  saveNeighborTargetList,
} from '@/lib/utils/neighbor-target-list';

/**
 * 네이버 서로이웃 목록을 동기화하는 API
 * - 관리자 페이지에서 서로이웃 ID 목록 추출
 * - 기존 목록에 없는 새 이웃만 추가
 * - Supabase에도 반영
 */

export interface SyncBuddyResult {
  success: boolean;
  totalFetched: number;   // 네이버에서 가져온 총 서로이웃 수
  totalAdded: number;     // 새로 추가된 수
  totalAlready: number;   // 이미 있던 수
  addedNicknames: string[];
  allNicknames: string[];
  error?: string;
}

async function fetchMutualBuddiesWithPlaywright(
  blogId: string,
  blogPassword: string
): Promise<string[]> {
  const { chromium } = await import('playwright');

  let browser = null;

  try {
    browser = await chromium.launch({
      headless: false,
      args: ['--disable-blink-features=AutomationControlled'],
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);

    // 1단계: 네이버 로그인
    console.log('[동기화] 네이버 로그인 중...');
    await page.goto('https://nid.naver.com/nidlogin.login', {
      waitUntil: 'domcontentloaded',
    });
    await page.locator('input[name="id"]').fill(blogId);
    await page.waitForTimeout(500);
    await page.locator('input[name="pw"]').fill(blogPassword);
    await page.waitForTimeout(500);
    await page.locator('button:has-text("로그인")').first().click();

    // 로그인 완료 대기 (최대 2분)
    let loginSuccess = false;
    for (let i = 0; i < 120; i++) {
      if (!page.url().includes('nid.naver.com/nidlogin.login')) {
        loginSuccess = true;
        break;
      }
      await page.waitForTimeout(1000);
    }
    if (!loginSuccess) throw new Error('로그인 실패');
    await page.waitForTimeout(2000);
    console.log('[동기화] 로그인 성공');

    // 2단계: 이웃 관리 페이지 접속
    console.log('[동기화] 이웃 관리 페이지 이동 중...');
    await page.goto(`https://admin.blog.naver.com/${blogId}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(2000);

    // 관리자 페이지는 iframe(#papermain) 내부에 콘텐츠가 있음
    const getIframeDoc = async () => {
      const frameEl = await page.$('iframe#papermain, frame#papermain');
      if (frameEl) {
        const frame = await frameEl.contentFrame();
        return frame;
      }
      return null;
    };

    // 3단계: "내가 추가한 이웃" 클릭 - iframe 내부에서 시도
    console.log('[동기화] 내가 추가한 이웃 클릭...');

    // iframe 내부에서 찾기
    let frame = await getIframeDoc();

    if (frame) {
      try {
        await frame.waitForSelector('#buddylist_config_anchor', { timeout: 10000 });
        await frame.click('#buddylist_config_anchor');
        console.log('[동기화] iframe 내부에서 이웃 관리 클릭 완료');
      } catch {
        console.log('[동기화] iframe 내부 클릭 실패, 메인 페이지에서 시도...');
        await page.click('#buddylist_config_anchor').catch(() => {});
      }
    } else {
      await page.click('#buddylist_config_anchor').catch(() => {});
    }

    await page.waitForTimeout(3000);

    // iframe 재취득 (페이지 전환 후)
    frame = await getIframeDoc();

    // 4단계: 셀렉트 박스에서 "서로이웃" 선택
    console.log('[동기화] 서로이웃 선택 중...');
    const selectAndFilter = async (targetFrame: any) => {
      try {
        // 셀렉트 박스 클릭
        await targetFrame.waitForSelector('#buddysel_buudyall', { timeout: 8000 });
        await targetFrame.click('#buddysel_buudyall');
        await page.waitForTimeout(1000);

        // "서로이웃" 옵션 클릭 (span 태그)
        const options = await targetFrame.$$('#buddysel_buudyall > div.selectbox-box > span');
        let selected = false;
        for (const opt of options) {
          const text = await opt.textContent();
          if (text && text.trim() === '서로이웃') {
            await opt.click();
            selected = true;
            console.log('[동기화] 서로이웃 필터 선택 완료');
            break;
          }
        }
        if (!selected) {
          // li 태그로도 시도
          const liOptions = await targetFrame.$$('#buddysel_buudyall li, #buddysel_buudyall option');
          for (const li of liOptions) {
            const text = await li.textContent();
            if (text && text.includes('서로이웃')) {
              await li.click();
              selected = true;
              break;
            }
          }
        }
        return selected;
      } catch (err) {
        console.log('[동기화] 셀렉트 박스 조작 실패:', err);
        return false;
      }
    };

    if (frame) {
      await selectAndFilter(frame);
    } else {
      await selectAndFilter(page);
    }
    await page.waitForTimeout(2000);

    // 5~7단계: 페이지별 서로이웃 ID 추출
    const allBuddyIds: string[] = [];
    let pageNum = 1;

    while (true) {
      console.log(`[동기화] 페이지 ${pageNum} 목록 추출 중...`);

      // iframe 재취득
      frame = await getIframeDoc();
      const targetCtx = frame || page;

      // 이웃 블로그 링크 추출
      const buddyIds = await targetCtx.evaluate(() => {
        const ids: string[] = [];

        // tr.first 및 tr:nth-child 행에서 링크 추출
        const rows = document.querySelectorAll(
          '#buddyListManageForm > table > tbody > tr'
        );

        rows.forEach((row) => {
          const link = row.querySelector('td.buddy > div > a') as HTMLAnchorElement;
          if (!link) return;

          const href = link.href || '';
          // https://blog.naver.com/[ID] 에서 ID 추출
          const match = href.match(/blog\.naver\.com\/([^/?#]+)/);
          if (match && match[1]) {
            ids.push(match[1]);
          }
        });

        return ids;
      });

      console.log(`[동기화] 페이지 ${pageNum}: ${buddyIds.length}개 추출`);

      if (buddyIds.length === 0) {
        console.log('[동기화] 더 이상 목록이 없습니다.');
        break;
      }

      allBuddyIds.push(...buddyIds);

      // 다음 페이지 버튼 확인
      const hasNextPage = await targetCtx.evaluate((currentPage: number) => {
        // 페이지네이션에서 다음 페이지 링크 찾기
        const nextPageLink = document.querySelector(
          `#buddyListManageForm a[href*="currentPage=${currentPage + 1}"], ` +
          `#buddyListManageForm .paginate a:last-child, ` +
          `.paginate_area a[onclick*="${currentPage + 1}"]`
        ) as HTMLAnchorElement;

        if (nextPageLink) {
          nextPageLink.click();
          return true;
        }

        // 숫자 페이지 링크로도 시도
        const pageLinks = document.querySelectorAll(
          '#buddyListManageForm .paginate a, .paginate_area a'
        );
        for (const link of Array.from(pageLinks)) {
          const text = link.textContent?.trim();
          if (text === String(currentPage + 1)) {
            (link as HTMLElement).click();
            return true;
          }
        }

        return false;
      }, pageNum);

      if (!hasNextPage) {
        console.log('[동기화] 마지막 페이지입니다.');
        break;
      }

      pageNum++;
      await page.waitForTimeout(2000);

      // 50페이지 제한 (무한 루프 방지)
      if (pageNum > 50) break;
    }

    console.log(`[동기화] 총 ${allBuddyIds.length}명 서로이웃 추출 완료`);
    return [...new Set(allBuddyIds)]; // 중복 제거
  } finally {
    if (browser) await browser.close();
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<SyncBuddyResult>> {
  const isLocal = process.env.NODE_ENV === 'development' && !process.env.VERCEL;

  if (!isLocal) {
    return NextResponse.json(
      {
        success: false,
        error: '이 기능은 로컬 개발 환경에서만 사용 가능합니다.',
        totalFetched: 0,
        totalAdded: 0,
        totalAlready: 0,
        addedNicknames: [],
        allNicknames: [],
      },
      { status: 403 }
    );
  }

  try {
    const { blogId, blogPassword } = await request.json();

    if (!blogId || !blogPassword) {
      return NextResponse.json(
        {
          success: false,
          error: '블로그 ID와 비밀번호를 입력하세요.',
          totalFetched: 0,
          totalAdded: 0,
          totalAlready: 0,
          addedNicknames: [],
          allNicknames: [],
        },
        { status: 400 }
      );
    }

    console.log('\n========== 서로이웃 목록 동기화 시작 ==========');

    // 네이버에서 서로이웃 목록 가져오기
    const fetchedIds = await fetchMutualBuddiesWithPlaywright(blogId, blogPassword);
    console.log(`[동기화] 네이버 서로이웃 ${fetchedIds.length}명`);

    // 기존 목록 조회
    const existing = (await getNeighborTargetList()) || [];
    console.log(`[동기화] 기존 목록 ${existing.length}명`);

    // 새로 추가할 이웃만 필터링
    const addedNicknames = fetchedIds.filter((id) => !existing.includes(id));
    const mergedList = [...new Set([...existing, ...fetchedIds])];

    console.log(`[동기화] 새로 추가: ${addedNicknames.length}명`);

    // Supabase에 저장
    if (addedNicknames.length > 0) {
      const saved = await saveNeighborTargetList(mergedList);
      if (!saved) {
        console.warn('[동기화] Supabase 저장 실패');
      }
    }

    console.log('========== 동기화 완료 ==========\n');

    return NextResponse.json({
      success: true,
      totalFetched: fetchedIds.length,
      totalAdded: addedNicknames.length,
      totalAlready: existing.filter((id) => fetchedIds.includes(id)).length,
      addedNicknames,
      allNicknames: mergedList,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('[동기화] 오류:', msg);
    return NextResponse.json(
      {
        success: false,
        error: msg,
        totalFetched: 0,
        totalAdded: 0,
        totalAlready: 0,
        addedNicknames: [],
        allNicknames: [],
      },
      { status: 500 }
    );
  }
}
