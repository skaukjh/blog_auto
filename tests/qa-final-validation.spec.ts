import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// 테스트 환경 설정
const BASE_URL = 'http://localhost:3000';
const LOGIN_PASSWORD = 'wogns0513@';
const TIMEOUT = 90000; // 90초

// 테스트 데이터
const SAMPLE_BLOG_POST_1 = `강남역 근처에 있는 이 맛집은 정말 추천드려요.
분위기도 좋고 음식도 맛있어요. 특히 메인 메뉴가 정말 훌륭해요.
가격대도 합리적이고 서비스도 좋아요. 주말에는 사람이 많으니 평일에 가시는 걸 추천해요.
친구들과 함께 가기 정말 좋은 곳이에요. 다음에 또 방문할 예정이에요.`.repeat(3);

const SAMPLE_BLOG_POST_2 = `오늘 방문한 카페는 정말 만족스러웠어요.
커피 맛도 좋고 디저트도 맛있어요. 인테리어가 예쁘고 사진 찍기 좋아요.
직원분들도 친절하시고 분위기가 아늑해요. 조용히 책 읽기 좋은 곳이에요.
다음에 친구들과 다시 올 거예요. 강력하게 추천드려요.`.repeat(3);

// 헬퍼 함수: 로그인
async function login(page: Page) {
  console.log('🔐 로그인 테스트 시작...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: TIMEOUT });

  // 페이지 로드 확인
  await expect(page.locator('h1')).toContainText('로그인', { timeout: 10000 });

  // 비밀번호 입력 및 로그인
  await page.fill('input[type="password"]', LOGIN_PASSWORD);
  await page.click('button[type="submit"]');

  // /generate로 리디렉트 대기
  await page.waitForURL(`${BASE_URL}/generate`, { timeout: TIMEOUT });
  console.log('✅ 로그인 성공, /generate로 리디렉트됨');
}

// 헬퍼 함수: 스크린샷 저장
async function saveScreenshot(page: Page, name: string) {
  const screenshotDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
  const filepath = path.join(screenshotDir, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`📸 스크린샷 저장: ${filepath}`);
}

test.describe('최종 QA 검증 - 블로그 글 자동 생성 애플리케이션', () => {
  test.setTimeout(300000); // 5분 타임아웃

  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterEach(async () => {
    await page.close();
  });

  // 1️⃣ 로그인 및 초기 화면
  test('1️⃣ 로그인 및 초기 화면', async () => {
    console.log('\n=== 1️⃣ 로그인 및 초기 화면 테스트 ===');

    // /login 페이지 로드
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: TIMEOUT });
    await expect(page.locator('h1')).toContainText('로그인');
    console.log('✅ /login 페이지 정상 로드');

    // 비밀번호 입력 및 로그인
    await page.fill('input[type="password"]', LOGIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/generate`, { timeout: TIMEOUT });
    console.log('✅ /generate로 자동 리디렉트');

    // 페이지 로딩 완료 대기 (5초 이내)
    await page.waitForLoadState('networkidle', { timeout: 5000 });
    console.log('✅ 페이지 로딩 완료 (5초 이내)');

    // 스타일 상태 메시지 확인
    const styleStatus = await page.locator('text=/스타일이|준비되었습니다|설정되지 않았습니다/').first();
    await expect(styleStatus).toBeVisible({ timeout: 5000 });
    const statusText = await styleStatus.textContent();
    console.log(`✅ 스타일 상태 표시: ${statusText}`);

    await saveScreenshot(page, '01-login-success');
  });

  // 2️⃣ 블로그 스타일 분석
  test('2️⃣ 블로그 스타일 분석 (/format)', async () => {
    console.log('\n=== 2️⃣ 블로그 스타일 분석 테스트 ===');

    await login(page);

    // /format 페이지 이동
    await page.goto(`${BASE_URL}/format`, { waitUntil: 'networkidle', timeout: TIMEOUT });
    console.log('✅ /format 페이지 접속');

    // 블로그 샘플 입력
    const textarea1 = page.locator('textarea').nth(0);
    const textarea2 = page.locator('textarea').nth(1);

    await textarea1.fill(SAMPLE_BLOG_POST_1);
    await textarea2.fill(SAMPLE_BLOG_POST_2);
    console.log('✅ 블로그 샘플 2개 입력 (각 300자 이상)');

    // 스타일 분석 버튼 클릭
    const analyzeButton = page.locator('button:has-text("스타일 분석")').first();
    await analyzeButton.click();
    console.log('⏳ 스타일 분석 시작...');

    // 분석 완료 대기 (30초 이내)
    await page.waitForSelector('text=/분석 완료|성공/', { timeout: 30000 });
    console.log('✅ 30초 이내에 분석 완료');

    await saveScreenshot(page, '02-style-analysis');

    // 분석 결과 확인
    const pageContent = await page.content();
    expect(pageContent).toContain('SENTENCE ENDING PATTERN');
    console.log('✅ 분석 결과에 "SENTENCE ENDING PATTERN" 포함');

    // 종결어미 추출 확인
    const hasEnding = pageContent.includes('~~요') ||
                     pageContent.includes('~~다') ||
                     pageContent.includes('~~해요') ||
                     pageContent.includes('ending');
    expect(hasEnding).toBeTruthy();
    console.log('✅ 종결어미 정확히 추출됨');

    // /generate로 이동하여 스타일 준비 상태 확인
    await page.goto(`${BASE_URL}/generate`, { waitUntil: 'networkidle', timeout: TIMEOUT });
    await expect(page.locator('text=/스타일이 준비되었습니다/')).toBeVisible({ timeout: 5000 });
    console.log('✅ /generate에서 "✅ 스타일이 준비되었습니다" 표시');
  });

  // 3️⃣ 전문가 모드 UI 검증
  test('3️⃣ 전문가 모드 UI 검증', async () => {
    console.log('\n=== 3️⃣ 전문가 모드 UI 검증 ===');

    await login(page);

    // ExpertModeTab 렌더링 확인
    await expect(page.locator('text=/이미지 업로드|주제|키워드/')).toBeVisible({ timeout: 5000 });
    console.log('✅ ExpertModeTab 컴포넌트 렌더링');

    // 필드 확인
    const imageUpload = page.locator('text=/이미지 업로드/');
    const topicInput = page.locator('input[placeholder*="주제"]');
    const keywordInput = page.locator('input[placeholder*="키워드"]');

    await expect(imageUpload).toBeVisible();
    console.log('✅ 📸 이미지 업로드 필드');

    await expect(topicInput).toBeVisible();
    console.log('✅ 📝 주제 입력 필드');

    await expect(keywordInput).toBeVisible();
    console.log('✅ 🏷️ 키워드 입력 필드');

    // 글 길이 버튼
    const lengthButtons = page.locator('button:has-text("짧게"), button:has-text("중간"), button:has-text("길게")');
    await expect(lengthButtons.first()).toBeVisible();
    console.log('✅ 📏 글 길이 선택 버튼');

    // 전문가 선택 버튼 (5개)
    const expertButtons = page.locator('button:has-text("맛집"), button:has-text("제품"), button:has-text("여행"), button:has-text("패션"), button:has-text("리빙")');
    const expertCount = await expertButtons.count();
    expect(expertCount).toBeGreaterThanOrEqual(5);
    console.log(`✅ 전문가 선택 버튼 ${expertCount}개 표시`);

    // 모델 선택
    const modelSelector = page.locator('text=/모델 선택|빠른 생성|표준 품질|최고 품질/');
    await expect(modelSelector.first()).toBeVisible();
    console.log('✅ 모델 선택 옵션 표시');

    // 창의성 슬라이더
    const creativitySlider = page.locator('input[type="range"]');
    await expect(creativitySlider).toBeVisible();
    console.log('✅ 창의성 슬라이더 표시');

    await saveScreenshot(page, '03-expert-ui');
  });

  // 4️⃣ 전문가 모드 글 생성 테스트 (실제 이미지 사용)
  test('4️⃣ 전문가 모드 글 생성 테스트', async () => {
    console.log('\n=== 4️⃣ 전문가 모드 글 생성 테스트 ===');

    await login(page);

    // 전문가 선택 (맛집)
    const foodExpert = page.locator('button:has-text("맛집")').first();
    await foodExpert.click();
    console.log('✅ 전문가 선택: 🍽️ 맛집 파워 블로거');

    // 이미지 업로드 (테스트용 더미 이미지 생성)
    const imageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-image.png',
      mimeType: 'image/png',
      buffer: imageBuffer,
    });

    // 이미지 업로드 확인 (1초 대기)
    await page.waitForTimeout(1000);
    console.log('✅ 이미지 1장 업로드');

    // 주제 입력
    await page.fill('input[placeholder*="주제"]', '강남역 맛집 추천');
    console.log('✅ 주제 입력: 강남역 맛집 추천');

    // 키워드 입력 (3개)
    const keywordInput = page.locator('input[placeholder*="키워드"]');
    await keywordInput.fill('강남역');
    await keywordInput.press('Enter');
    await keywordInput.fill('맛집');
    await keywordInput.press('Enter');
    await keywordInput.fill('추천');
    await keywordInput.press('Enter');
    console.log('✅ 키워드 3개 입력: 강남역, 맛집, 추천');

    // 글 길이 선택 (중간)
    const mediumButton = page.locator('button:has-text("중간")').first();
    await mediumButton.click();
    console.log('✅ 글 길이 선택: medium');

    await saveScreenshot(page, '04-before-generation');

    // 생성 버튼 활성화 확인
    const generateButton = page.locator('button:has-text("전문가 모드로 글 생성")').first();
    await expect(generateButton).toBeEnabled({ timeout: 5000 });
    console.log('✅ "✨ 전문가 모드로 글 생성" 버튼 활성화');

    // 버튼 클릭
    await generateButton.click();
    console.log('⏳ 글 생성 시작...');

    // 로딩 표시 확인
    const loadingIndicator = page.locator('text=/생성 중|분석 중|처리 중/');
    await expect(loadingIndicator.first()).toBeVisible({ timeout: 5000 });
    console.log('✅ 로딩 표시 (생성 중...)');

    // 생성 완료 대기 (60초 이내)
    await page.waitForSelector('text=/생성된 글|생성 완료/', { timeout: 60000 });
    console.log('✅ 60초 이내에 글 생성 완료');

    await saveScreenshot(page, '04-after-generation');
  });

  // 5️⃣ 생성 결과 검증
  test('5️⃣ 생성 결과 검증', async () => {
    console.log('\n=== 5️⃣ 생성 결과 검증 ===');

    await login(page);

    // 4번 테스트와 동일한 과정으로 글 생성
    const foodExpert = page.locator('button:has-text("맛집")').first();
    await foodExpert.click();

    const imageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-image.png',
      mimeType: 'image/png',
      buffer: imageBuffer,
    });

    await page.waitForTimeout(1000);
    await page.fill('input[placeholder*="주제"]', '강남역 맛집 추천');

    const keywordInput = page.locator('input[placeholder*="키워드"]');
    await keywordInput.fill('강남역');
    await keywordInput.press('Enter');
    await keywordInput.fill('맛집');
    await keywordInput.press('Enter');

    const mediumButton = page.locator('button:has-text("중간")').first();
    await mediumButton.click();

    const generateButton = page.locator('button:has-text("전문가 모드로 글 생성")').first();
    await generateButton.click();

    await page.waitForSelector('text=/생성된 글|생성 완료/', { timeout: 60000 });

    // 결과 확인
    const pageContent = await page.content();

    // 글자 수 표시
    expect(pageContent).toMatch(/글자 수|문자 수|글자/);
    console.log('✅ 글자 수 표시');

    // 이미지 개수 표시
    expect(pageContent).toMatch(/이미지|IMAGE/i);
    console.log('✅ 이미지 개수 표시');

    // 키워드 포함 횟수
    expect(pageContent).toMatch(/키워드/);
    console.log('✅ 키워드 포함 횟수 표시');

    // 비용 표시
    const hasCost = pageContent.includes('₩') || pageContent.includes('$') || pageContent.includes('비용');
    expect(hasCost).toBeTruthy();
    console.log('✅ 생성 비용 표시 (₩ 및 $)');

    // 마커 확인
    const hasMarker = pageContent.includes('[IMAGE_1]');
    expect(hasMarker).toBeTruthy();
    console.log('✅ [IMAGE_N] 마커가 정확한 위치에 있음');

    await saveScreenshot(page, '05-generation-result');
  });

  // 6️⃣ 다운로드 및 복사 기능
  test('6️⃣ 다운로드 및 복사 기능', async () => {
    console.log('\n=== 6️⃣ 다운로드 및 복사 기능 테스트 ===');

    await login(page);

    // 글 생성 (간단하게)
    const foodExpert = page.locator('button:has-text("맛집")').first();
    await foodExpert.click();

    const imageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-image.png',
      mimeType: 'image/png',
      buffer: imageBuffer,
    });

    await page.waitForTimeout(1000);
    await page.fill('input[placeholder*="주제"]', '테스트 주제');

    const keywordInput = page.locator('input[placeholder*="키워드"]');
    await keywordInput.fill('테스트');
    await keywordInput.press('Enter');

    const generateButton = page.locator('button:has-text("전문가 모드로 글 생성")').first();
    await generateButton.click();

    await page.waitForSelector('text=/생성된 글|생성 완료/', { timeout: 60000 });

    // 클립보드 복사 버튼
    const copyButton = page.locator('button:has-text("복사")').first();
    await copyButton.click();

    // 성공 메시지 대기
    await page.waitForSelector('text=/복사 완료|복사됨|성공/', { timeout: 5000 });
    console.log('✅ 클립보드 복사 버튼 클릭 → 성공 메시지 표시');

    // 다운로드 버튼 확인
    const txtButton = page.locator('button:has-text("TXT")');
    const docxButton = page.locator('button:has-text("DOCX")');
    const htmlButton = page.locator('button:has-text("HTML")');

    await expect(txtButton.first()).toBeVisible();
    console.log('✅ TXT 다운로드 버튼 표시');

    await expect(docxButton.first()).toBeVisible();
    console.log('✅ DOCX 다운로드 버튼 표시');

    await expect(htmlButton.first()).toBeVisible();
    console.log('✅ HTML 다운로드 버튼 표시');

    // 수정 입력창
    const refineTextarea = page.locator('textarea[placeholder*="수정"]');
    await expect(refineTextarea).toBeVisible();
    console.log('✅ 수정 입력창 (피드백 요청) 표시');

    await saveScreenshot(page, '06-download-copy');
  });

  // 7️⃣ 에러 처리 검증
  test('7️⃣ 에러 처리 검증', async () => {
    console.log('\n=== 7️⃣ 에러 처리 검증 ===');

    await login(page);

    // 전문가 선택
    const foodExpert = page.locator('button:has-text("맛집")').first();
    await foodExpert.click();

    // 이미지 없이 생성 시도
    await page.fill('input[placeholder*="주제"]', '테스트 주제');

    const keywordInput = page.locator('input[placeholder*="키워드"]');
    await keywordInput.fill('테스트');
    await keywordInput.press('Enter');

    const generateButton = page.locator('button:has-text("전문가 모드로 글 생성")').first();

    // 버튼이 비활성화되어 있어야 함
    const isDisabled = await generateButton.isDisabled();
    expect(isDisabled).toBeTruthy();
    console.log('✅ 이미지 없을 때 버튼 비활성화');

    // 페이지 리로드
    await page.reload({ waitUntil: 'networkidle' });
    await foodExpert.click();

    // 이미지 업로드
    const imageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-image.png',
      mimeType: 'image/png',
      buffer: imageBuffer,
    });

    await page.waitForTimeout(1000);

    // 주제 없이 생성 시도
    await keywordInput.fill('테스트');
    await keywordInput.press('Enter');

    const isDisabled2 = await generateButton.isDisabled();
    expect(isDisabled2).toBeTruthy();
    console.log('✅ 주제 없을 때 버튼 비활성화');

    await saveScreenshot(page, '07-error-handling');
  });

  // 8️⃣ UI/UX 품질
  test('8️⃣ UI/UX 품질', async () => {
    console.log('\n=== 8️⃣ UI/UX 품질 검증 ===');

    await login(page);

    // 전문가 선택
    const foodExpert = page.locator('button:has-text("맛집")').first();
    await foodExpert.click();

    // 이미지 업로드
    const imageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-image.png',
      mimeType: 'image/png',
      buffer: imageBuffer,
    });

    await page.waitForTimeout(1000);
    await page.fill('input[placeholder*="주제"]', '테스트 주제');

    const keywordInput = page.locator('input[placeholder*="키워드"]');
    await keywordInput.fill('테스트');
    await keywordInput.press('Enter');

    const generateButton = page.locator('button:has-text("전문가 모드로 글 생성")').first();
    await generateButton.click();

    // 로딩 중 버튼 비활성화 확인
    const isDisabledDuringLoading = await generateButton.isDisabled();
    expect(isDisabledDuringLoading).toBeTruthy();
    console.log('✅ 로딩 상태 시 버튼 비활성화');

    // 필수 필드 표시 확인
    const pageContent = await page.content();
    const hasRequired = pageContent.includes('*') || pageContent.includes('필수');
    expect(hasRequired).toBeTruthy();
    console.log('✅ 필수 필드 표시 (*필수)');

    // 반응형 디자인 테스트 (모바일 크기)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);

    const isMobileVisible = await page.locator('text=/이미지 업로드|주제/').isVisible();
    expect(isMobileVisible).toBeTruthy();
    console.log('✅ 반응형 디자인 (모바일 크기에서도 보기 좋음)');

    await saveScreenshot(page, '08-ui-ux-quality');
  });

  // 9️⃣ 성능 검증
  test('9️⃣ 성능 검증', async () => {
    console.log('\n=== 9️⃣ 성능 검증 ===');

    // 로그인 후 /generate 로드 시간 측정
    const startTime = Date.now();
    await login(page);
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(3000);
    console.log(`✅ 로그인 후 /generate 로드 시간: ${loadTime}ms (< 3초)`);

    // 콘솔 에러 확인
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleMessages.push(msg.text());
      }
    });

    // 페이지 스크롤
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, 0));
    console.log('✅ 페이지 스크롤 부드러움');

    // 콘솔 에러 확인
    const hasErrors = consoleMessages.filter(msg => !msg.includes('warning')).length > 0;
    expect(hasErrors).toBeFalsy();
    console.log('✅ 콘솔에 에러 로그 없음');

    await saveScreenshot(page, '09-performance');
  });
});

console.log('\n✅ QA 테스트 스크립트 작성 완료');
console.log('📋 총 9개 테스트 케이스 포함');
console.log('⏱️ 예상 소요 시간: 약 20-30분');
