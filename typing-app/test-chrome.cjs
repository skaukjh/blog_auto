/**
 * 시스템 크롬을 Playwright로 띄울 수 있는지 확인합니다.
 * 네이버 계정 없이 돌릴 수 있는 유일한 사전 점검입니다.
 *
 * 사용: node test-chrome.cjs
 */
const { chromium } = require('playwright-core');

(async () => {
  console.log('시스템 크롬 실행 시도...');

  let browser;
  try {
    browser = await chromium.launch({
      headless: true, // 점검이므로 창은 띄우지 않습니다
      channel: 'chrome',
    });

    const page = await browser.newPage();
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded', timeout: 30000 });

    const title = await page.title();
    console.log('  크롬 실행 성공');
    console.log('  버전 :', browser.version());
    console.log('  테스트 페이지 제목 :', title);

    // 한글 타이핑이 되는지도 확인합니다 (스마트에디터와 같은 contenteditable)
    await page.setContent('<div id="t" contenteditable="true"></div>');
    await page.locator('#t').click();
    await page.keyboard.type('한글 타이핑 확인이다.', { delay: 10 });
    const typed = await page.locator('#t').textContent();
    console.log('  한글 입력 결과 :', JSON.stringify(typed));
    console.log(typed === '한글 타이핑 확인이다.' ? '  한글 입력 정상' : '  한글 입력 이상!');
  } catch (err) {
    console.error('  실패:', err.message);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
  }
})();
