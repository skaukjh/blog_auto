import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
const LOGIN_PASSWORD = 'wogns0513@';

test.describe('최종 QA 검증 - 간단 버전', () => {
  test.setTimeout(120000); // 2분 타임아웃

  test('1. 로그인 및 초기 화면', async ({ page }) => {
    console.log('\n=== 1️⃣ 로그인 및 초기 화면 ===');

    // /login 페이지 로드
    await page.goto(`${BASE_URL}/login`, { timeout: 30000 });
    console.log('✅ /login 페이지 접속');

    // 페이지 제목 확인
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    console.log('✅ 페이지 제목 표시');

    // 비밀번호 입력
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill(LOGIN_PASSWORD);
    console.log('✅ 비밀번호 입력');

    // 로그인 버튼 클릭
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    console.log('✅ 로그인 버튼 클릭');

    // /generate로 리디렉트 대기
    await page.waitForURL(`${BASE_URL}/generate`, { timeout: 30000 });
    console.log('✅ /generate로 자동 리디렉트');

    // 스크린샷 저장
    await page.screenshot({ path: 'test-results/01-login.png', fullPage: true });
    console.log('📸 스크린샷 저장: 01-login.png');
  });

  test('2. 전문가 모드 UI 확인', async ({ page }) => {
    console.log('\n=== 2️⃣ 전문가 모드 UI 확인 ===');

    // 로그인
    await page.goto(`${BASE_URL}/login`, { timeout: 30000 });
    await page.fill('input[type="password"]', LOGIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/generate`, { timeout: 30000 });

    // 페이지 로딩 대기
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    console.log('✅ /generate 페이지 로드 완료');

    // 전문가 선택 버튼 확인
    const expertButtons = page.locator('button');
    const buttonCount = await expertButtons.count();
    console.log(`📊 페이지 내 버튼 개수: ${buttonCount}`);

    // 이미지 업로드 필드 확인
    const fileInput = page.locator('input[type="file"]');
    const fileInputCount = await fileInput.count();
    console.log(`📊 파일 입력 필드 개수: ${fileInputCount}`);

    if (fileInputCount > 0) {
      console.log('✅ 이미지 업로드 필드 존재');
    }

    // 주제 입력 필드 확인
    const textInputs = page.locator('input[type="text"]');
    const textInputCount = await textInputs.count();
    console.log(`📊 텍스트 입력 필드 개수: ${textInputCount}`);

    // 스크린샷 저장
    await page.screenshot({ path: 'test-results/02-expert-ui.png', fullPage: true });
    console.log('📸 스크린샷 저장: 02-expert-ui.png');
  });

  test('3. 포맷 페이지 접속', async ({ page }) => {
    console.log('\n=== 3️⃣ 포맷 페이지 접속 ===');

    // 로그인
    await page.goto(`${BASE_URL}/login`, { timeout: 30000 });
    await page.fill('input[type="password"]', LOGIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/generate`, { timeout: 30000 });

    // /format 페이지 이동
    await page.goto(`${BASE_URL}/format`, { timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    console.log('✅ /format 페이지 접속');

    // textarea 확인
    const textareas = page.locator('textarea');
    const textareaCount = await textareas.count();
    console.log(`📊 Textarea 개수: ${textareaCount}`);

    if (textareaCount >= 2) {
      console.log('✅ 블로그 샘플 입력 필드 2개 이상 존재');
    }

    // 스크린샷 저장
    await page.screenshot({ path: 'test-results/03-format.png', fullPage: true });
    console.log('📸 스크린샷 저장: 03-format.png');
  });

  test('4. 전체 페이지 네비게이션', async ({ page }) => {
    console.log('\n=== 4️⃣ 전체 페이지 네비게이션 ===');

    // 로그인
    await page.goto(`${BASE_URL}/login`, { timeout: 30000 });
    await page.fill('input[type="password"]', LOGIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/generate`, { timeout: 30000 });

    // 네비게이션 링크 확인
    const navLinks = page.locator('nav a, header a');
    const linkCount = await navLinks.count();
    console.log(`📊 네비게이션 링크 개수: ${linkCount}`);

    // 각 링크 텍스트 출력
    for (let i = 0; i < Math.min(linkCount, 10); i++) {
      const linkText = await navLinks.nth(i).textContent();
      console.log(`  - 링크 ${i + 1}: ${linkText}`);
    }

    // 스크린샷 저장
    await page.screenshot({ path: 'test-results/04-navigation.png', fullPage: true });
    console.log('📸 스크린샷 저장: 04-navigation.png');
  });

  test('5. 반응형 디자인 확인', async ({ page }) => {
    console.log('\n=== 5️⃣ 반응형 디자인 확인 ===');

    // 로그인
    await page.goto(`${BASE_URL}/login`, { timeout: 30000 });
    await page.fill('input[type="password"]', LOGIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/generate`, { timeout: 30000 });

    // 데스크톱 크기
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/05-desktop.png', fullPage: true });
    console.log('✅ 데스크톱 크기 스크린샷');

    // 태블릿 크기
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/05-tablet.png', fullPage: true });
    console.log('✅ 태블릿 크기 스크린샷');

    // 모바일 크기
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/05-mobile.png', fullPage: true });
    console.log('✅ 모바일 크기 스크린샷');
  });
});
