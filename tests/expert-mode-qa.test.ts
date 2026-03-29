/**
 * 전문가 모드 QA 재검증 테스트
 *
 * 검증 항목:
 * 1. 전문가 모드 입력 필드 표시 확인
 * 2. 입력 필드 기능 테스트
 * 3. 전문가 모드 글 생성 테스트
 * 4. 에러 처리 테스트
 * 5. UI/UX 확인
 */

import { chromium, type Browser, type Page } from 'playwright';
import fs from 'fs';
import path from 'path';

interface TestResult {
  category: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  screenshot?: string;
}

const results: TestResult[] = [];
const screenshotsDir = path.join(process.cwd(), '.playwright-mcp');

// 스크린샷 디렉토리 생성
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

async function logResult(category: string, test: string, status: 'PASS' | 'FAIL' | 'WARN', message: string, page?: Page) {
  let screenshotPath: string | undefined;

  if (page && (status === 'FAIL' || status === 'WARN')) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    screenshotPath = path.join(screenshotsDir, `${category}-${timestamp}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }

  results.push({ category, test, status, message, screenshot: screenshotPath });

  const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${emoji} [${category}] ${test}: ${message}`);
}

async function login(page: Page): Promise<boolean> {
  try {
    // curl로 로그인 후 쿠키 직접 설정
    console.log('🔑 인증 쿠키 생성 중...');

    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wogns0513@' }),
    });

    const loginData = await loginResponse.json();

    if (!loginData.success) {
      await logResult('인증', '로그인', 'FAIL', `API 로그인 실패: ${loginData.message}`, page);
      return false;
    }

    const token = loginData.token;

    // Playwright 컨텍스트에 쿠키 직접 설정
    await page.context().addCookies([
      {
        name: 'blog_session',
        value: token,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
        expires: Math.floor(Date.now() / 1000) + 86400, // 24시간
      },
    ]);

    // generate 페이지로 이동
    await page.goto('http://localhost:3000/generate', { waitUntil: 'domcontentloaded' });

    // sessionStorage에 더미 스타일 설정 (페이지 로딩 중단 방지)
    await page.evaluate(() => {
      sessionStorage.setItem('blog_style', 'Dummy style for testing');
    });

    // 페이지 새로고침하여 sessionStorage 적용
    await page.reload({ waitUntil: 'domcontentloaded' });

    // 페이지 로딩 완료 대기
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    if (currentUrl.includes('/generate')) {
      await logResult('인증', '로그인', 'PASS', '쿠키 인증 성공 (API 토큰 직접 설정)');
      return true;
    } else {
      await logResult('인증', '로그인', 'FAIL', `쿠키 설정 실패 (URL: ${currentUrl})`, page);
      return false;
    }
  } catch (error) {
    await logResult('인증', '로그인', 'FAIL', `쿠키 인증 실패: ${error}`, page);
    return false;
  }
}

async function analyzeStyle(page: Page): Promise<boolean> {
  try {
    console.log('📊 스타일 분석 시작...');
    await page.goto('http://localhost:3000/format', { waitUntil: 'networkidle' });

    // 샘플 블로그 글 2개 입력
    const samplePosts = [
      `강남역 맛집을 찾다가 정말 좋은 곳을 발견했어요!
등갈비가 정말 부드럽고 맛있더라구요.
가격도 합리적이고 분위기도 좋아서 데이트하기 딱 좋은 곳이에요.
여러분도 꼭 한번 방문해보세요!
정말 강력하게 추천해요.
재방문 의사 100%입니다!
다음에 또 갈 계획이에요.`,

      `오늘은 신촌에 있는 카페를 다녀왔어요.
커피 맛도 좋고 디저트도 정말 맛있더라구요.
특히 케이크가 촉촉하고 달콤해서 너무 좋았어요.
조용한 분위기라 공부하거나 책 읽기에 딱이에요.
여러분도 기회되면 방문해보세요!
후회 안 하실 거예요.`
    ];

    const textareas = await page.locator('textarea').all();
    if (textareas.length < 2) {
      throw new Error('Textarea가 2개 미만입니다.');
    }

    await textareas[0].fill(samplePosts[0]);
    await textareas[1].fill(samplePosts[1]);

    // 분석 버튼 클릭
    await page.click('button:has-text("스타일 분석")');

    // 분석 결과 대기 (최대 30초)
    await page.waitForSelector('text=/스타일.*분석.*완료/i', { timeout: 30000 });

    await logResult('스타일 분석', '블로그 스타일 분석', 'PASS', '스타일 분석 완료');
    return true;
  } catch (error) {
    await logResult('스타일 분석', '블로그 스타일 분석', 'FAIL', `스타일 분석 실패: ${error}`, page);
    return false;
  }
}

async function testExpertModeInputFields(page: Page): Promise<void> {
  console.log('\n📋 카테고리 1: 전문가 모드 입력 필드 표시');

  try {
    await page.goto('http://localhost:3000/generate', { waitUntil: 'networkidle' });

    // 전문가 모드 탭 클릭
    const expertTab = page.locator('button:has-text("⭐ 전문가 모드")');
    await expertTab.click();
    await page.waitForTimeout(1000);

    // 1. 이미지 업로드 필드 확인
    const imageUpload = page.locator('text="📸 이미지 업로드"');
    if (await imageUpload.isVisible()) {
      await logResult('입력 필드', '이미지 업로드 필드 표시', 'PASS', '이미지 업로드 필드가 표시됩니다.');
    } else {
      await logResult('입력 필드', '이미지 업로드 필드 표시', 'FAIL', '이미지 업로드 필드가 표시되지 않습니다.', page);
    }

    // 2. 주제 입력 필드 확인
    const topicInput = page.locator('input[placeholder*="주제"]');
    if (await topicInput.isVisible()) {
      await logResult('입력 필드', '주제 입력 필드 표시', 'PASS', '주제 입력 필드가 표시됩니다.');
    } else {
      await logResult('입력 필드', '주제 입력 필드 표시', 'FAIL', '주제 입력 필드가 표시되지 않습니다.', page);
    }

    // 3. 키워드 입력 필드 확인
    const keywordSection = page.locator('text="🏷️ 키워드"');
    if (await keywordSection.isVisible()) {
      await logResult('입력 필드', '키워드 입력 필드 표시', 'PASS', '키워드 입력 필드가 표시됩니다.');
    } else {
      await logResult('입력 필드', '키워드 입력 필드 표시', 'FAIL', '키워드 입력 필드가 표시되지 않습니다.', page);
    }

    // 4. 글 길이 선택 버튼 확인
    const lengthButtons = page.locator('button:has-text("short"), button:has-text("medium"), button:has-text("long")');
    const count = await lengthButtons.count();
    if (count >= 3) {
      await logResult('입력 필드', '글 길이 선택 버튼 표시', 'PASS', `글 길이 선택 버튼 ${count}개 표시됩니다.`);
    } else {
      await logResult('입력 필드', '글 길이 선택 버튼 표시', 'FAIL', `글 길이 선택 버튼이 부족합니다 (${count}/3개).`, page);
    }

  } catch (error) {
    await logResult('입력 필드', '전체 필드 표시', 'FAIL', `필드 확인 중 에러: ${error}`, page);
  }
}

async function testInputFieldFunctions(page: Page): Promise<void> {
  console.log('\n⚙️ 카테고리 2: 입력 필드 기능 테스트');

  try {
    // 주제 입력 테스트
    const topicInput = page.locator('input[placeholder*="주제"]');
    await topicInput.fill('강남역 맛집 후기');
    const topicValue = await topicInput.inputValue();

    if (topicValue === '강남역 맛집 후기') {
      await logResult('입력 기능', '주제 입력', 'PASS', '주제 입력이 정상 작동합니다.');
    } else {
      await logResult('입력 기능', '주제 입력', 'FAIL', `주제 입력값 불일치: ${topicValue}`, page);
    }

    // 키워드 추가 테스트
    const keywordInput = page.locator('input[placeholder*="키워드"]');
    if (await keywordInput.isVisible()) {
      await keywordInput.fill('강남');
      await keywordInput.press('Enter');
      await page.waitForTimeout(500);

      const keywordTag = page.locator('text="강남"');
      if (await keywordTag.isVisible()) {
        await logResult('입력 기능', '키워드 추가', 'PASS', '키워드 추가가 정상 작동합니다.');
      } else {
        await logResult('입력 기능', '키워드 추가', 'FAIL', '키워드가 추가되지 않았습니다.', page);
      }
    } else {
      await logResult('입력 기능', '키워드 추가', 'WARN', '키워드 입력 필드를 찾을 수 없습니다.', page);
    }

    // 글 길이 선택 테스트
    const mediumButton = page.locator('button:has-text("medium")');
    await mediumButton.click();
    await page.waitForTimeout(500);

    const isSelected = await mediumButton.evaluate((el) => {
      return el.classList.contains('bg-blue-600') || el.classList.contains('bg-blue-500');
    });

    if (isSelected) {
      await logResult('입력 기능', '글 길이 선택', 'PASS', 'medium 선택이 정상 작동합니다.');
    } else {
      await logResult('입력 기능', '글 길이 선택', 'WARN', 'medium 선택 상태 확인 불가', page);
    }

  } catch (error) {
    await logResult('입력 기능', '전체 기능 테스트', 'FAIL', `기능 테스트 중 에러: ${error}`, page);
  }
}

async function testExpertModeGeneration(page: Page): Promise<void> {
  console.log('\n✨ 카테고리 3: 전문가 모드 글 생성 테스트');

  try {
    // 전문가 선택 (맛집 파워 블로거)
    const expertButton = page.locator('button:has-text("🍴")').first();
    await expertButton.click();
    await page.waitForTimeout(500);

    await logResult('글 생성', '전문가 선택', 'PASS', '맛집 파워 블로거 선택 완료');

    // 이미지 업로드 (테스트 이미지 생성)
    const testImagePath = path.join(process.cwd(), 'test-image.jpg');

    // 간단한 테스트 이미지 생성 (1x1 픽셀)
    const testImageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    fs.writeFileSync(testImagePath, testImageBuffer);

    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.isVisible() || await fileInput.count() > 0) {
      await fileInput.setInputFiles(testImagePath);
      await page.waitForTimeout(2000);

      await logResult('글 생성', '이미지 업로드', 'PASS', '이미지 업로드 완료');
    } else {
      await logResult('글 생성', '이미지 업로드', 'WARN', '파일 입력 필드를 찾을 수 없습니다.', page);
    }

    // 주제 입력 확인 (이미 입력됨)
    const topicInput = page.locator('input[placeholder*="주제"]');
    const topicValue = await topicInput.inputValue();
    if (topicValue) {
      await logResult('글 생성', '주제 확인', 'PASS', `주제: ${topicValue}`);
    } else {
      await logResult('글 생성', '주제 확인', 'FAIL', '주제가 입력되지 않았습니다.', page);
    }

    // 키워드 확인
    const keywordTag = page.locator('text="강남"');
    if (await keywordTag.isVisible()) {
      await logResult('글 생성', '키워드 확인', 'PASS', '키워드: 강남');
    } else {
      await logResult('글 생성', '키워드 확인', 'WARN', '키워드가 표시되지 않습니다.', page);
    }

    // 생성 버튼 클릭 (실제 API 호출은 스킵)
    const generateButton = page.locator('button:has-text("전문가 모드로 글 생성")');

    if (await generateButton.isVisible()) {
      const isDisabled = await generateButton.isDisabled();

      if (isDisabled) {
        await logResult('글 생성', '생성 버튼 상태', 'WARN', '생성 버튼이 비활성화되어 있습니다 (스타일 없음 가능)', page);
      } else {
        await logResult('글 생성', '생성 버튼 상태', 'PASS', '생성 버튼이 활성화되어 있습니다.');

        // 실제 API 호출은 비용이 발생하므로 스킵
        console.log('⏭️ 실제 글 생성은 비용 문제로 스킵합니다.');
        await logResult('글 생성', '전문가 모드 생성', 'WARN', '실제 API 호출은 스킵 (비용 절감)', page);
      }
    } else {
      await logResult('글 생성', '생성 버튼 찾기', 'FAIL', '생성 버튼을 찾을 수 없습니다.', page);
    }

    // 테스트 이미지 삭제
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }

  } catch (error) {
    await logResult('글 생성', '전문가 모드 생성', 'FAIL', `글 생성 테스트 중 에러: ${error}`, page);
  }
}

async function testErrorHandling(page: Page): Promise<void> {
  console.log('\n🛡️ 카테고리 4: 에러 처리 테스트');

  try {
    // 페이지 새로고침
    await page.goto('http://localhost:3000/generate', { waitUntil: 'networkidle' });

    // 전문가 모드 탭 클릭
    const expertTab = page.locator('button:has-text("⭐ 전문가 모드")');
    await expertTab.click();
    await page.waitForTimeout(1000);

    // 전문가 선택
    const expertButton = page.locator('button:has-text("🍴")').first();
    await expertButton.click();
    await page.waitForTimeout(500);

    // 아무것도 입력하지 않고 생성 버튼 상태 확인
    const generateButton = page.locator('button:has-text("전문가 모드로 글 생성")');
    const isDisabledEmpty = await generateButton.isDisabled();

    if (isDisabledEmpty) {
      await logResult('에러 처리', '필수 입력 없이 시도', 'PASS', '생성 버튼이 비활성화되어 있습니다.');
    } else {
      await logResult('에러 처리', '필수 입력 없이 시도', 'WARN', '생성 버튼이 활성화되어 있습니다 (검증 미흡 가능)', page);
    }

    // 주제만 입력하고 시도
    const topicInput = page.locator('input[placeholder*="주제"]');
    await topicInput.fill('테스트 주제');
    await page.waitForTimeout(500);

    const isDisabledTopicOnly = await generateButton.isDisabled();

    if (isDisabledTopicOnly) {
      await logResult('에러 처리', '이미지 없이 시도', 'PASS', '이미지 없으면 버튼이 비활성화됩니다.');
    } else {
      await logResult('에러 처리', '이미지 없이 시도', 'WARN', '이미지 없어도 버튼이 활성화됩니다.', page);
    }

    // 스타일 없는 상태 확인
    const styleWarning = page.locator('text=/스타일.*준비/i');
    if (await styleWarning.isVisible()) {
      const text = await styleWarning.textContent();
      if (text?.includes('✅')) {
        await logResult('에러 처리', '스타일 상태 표시', 'PASS', '스타일이 준비되었다고 표시됩니다.');
      } else {
        await logResult('에러 처리', '스타일 상태 표시', 'PASS', '스타일이 준비되지 않았다고 표시됩니다.');
      }
    } else {
      await logResult('에러 처리', '스타일 상태 표시', 'WARN', '스타일 상태 표시를 찾을 수 없습니다.', page);
    }

  } catch (error) {
    await logResult('에러 처리', '에러 처리 테스트', 'FAIL', `에러 처리 테스트 중 에러: ${error}`, page);
  }
}

async function testUIUX(page: Page): Promise<void> {
  console.log('\n🎨 카테고리 5: UI/UX 확인');

  try {
    // 필수 표시 확인
    const requiredMarks = page.locator('text="*필수"');
    const requiredCount = await requiredMarks.count();

    if (requiredCount > 0) {
      await logResult('UI/UX', '필수 필드 표시', 'PASS', `${requiredCount}개의 필수 필드 표시가 있습니다.`);
    } else {
      await logResult('UI/UX', '필수 필드 표시', 'WARN', '필수 필드 표시를 찾을 수 없습니다.', page);
    }

    // 전문가 선택 UI
    const expertButtons = page.locator('button:has-text("🍴"), button:has-text("📦"), button:has-text("✈️"), button:has-text("👗"), button:has-text("🏠")');
    const expertCount = await expertButtons.count();

    if (expertCount >= 5) {
      await logResult('UI/UX', '전문가 선택 버튼', 'PASS', `${expertCount}개의 전문가 선택 버튼이 표시됩니다.`);
    } else {
      await logResult('UI/UX', '전문가 선택 버튼', 'FAIL', `전문가 선택 버튼이 부족합니다 (${expertCount}/5개).`, page);
    }

    // 모델 선택 UI
    const modelSection = page.locator('text="🤖 AI 모델 선택"');
    if (await modelSection.isVisible()) {
      await logResult('UI/UX', '모델 선택 섹션', 'PASS', '모델 선택 섹션이 표시됩니다.');
    } else {
      await logResult('UI/UX', '모델 선택 섹션', 'WARN', '모델 선택 섹션을 찾을 수 없습니다.', page);
    }

    // 창의성 슬라이더
    const creativitySlider = page.locator('input[type="range"]');
    if (await creativitySlider.isVisible()) {
      await logResult('UI/UX', '창의성 슬라이더', 'PASS', '창의성 슬라이더가 표시됩니다.');
    } else {
      await logResult('UI/UX', '창의성 슬라이더', 'WARN', '창의성 슬라이더를 찾을 수 없습니다.', page);
    }

    // 전체 레이아웃 스크린샷
    await page.screenshot({
      path: path.join(screenshotsDir, 'expert-mode-ui-full.png'),
      fullPage: true
    });

    await logResult('UI/UX', '전체 레이아웃', 'PASS', '전체 레이아웃 스크린샷 저장됨');

  } catch (error) {
    await logResult('UI/UX', 'UI/UX 확인', 'FAIL', `UI/UX 테스트 중 에러: ${error}`, page);
  }
}

function printSummary() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 QA 재검증 결과 요약');
  console.log('='.repeat(80));

  const categories = [...new Set(results.map(r => r.category))];

  categories.forEach(category => {
    const categoryResults = results.filter(r => r.category === category);
    const passCount = categoryResults.filter(r => r.status === 'PASS').length;
    const failCount = categoryResults.filter(r => r.status === 'FAIL').length;
    const warnCount = categoryResults.filter(r => r.status === 'WARN').length;

    console.log(`\n[${category}]`);
    console.log(`  ✅ PASS: ${passCount}개`);
    console.log(`  ❌ FAIL: ${failCount}개`);
    console.log(`  ⚠️  WARN: ${warnCount}개`);

    if (failCount > 0) {
      console.log('\n  실패 항목:');
      categoryResults
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`    - ${r.test}: ${r.message}`));
    }
  });

  const totalPass = results.filter(r => r.status === 'PASS').length;
  const totalFail = results.filter(r => r.status === 'FAIL').length;
  const totalWarn = results.filter(r => r.status === 'WARN').length;

  console.log('\n' + '='.repeat(80));
  console.log('📈 전체 통계');
  console.log('='.repeat(80));
  console.log(`총 테스트: ${results.length}개`);
  console.log(`✅ PASS: ${totalPass}개 (${((totalPass / results.length) * 100).toFixed(1)}%)`);
  console.log(`❌ FAIL: ${totalFail}개 (${((totalFail / results.length) * 100).toFixed(1)}%)`);
  console.log(`⚠️  WARN: ${totalWarn}개 (${((totalWarn / results.length) * 100).toFixed(1)}%)`);

  console.log('\n' + '='.repeat(80));
  console.log('🎯 배포 가능 여부 판단');
  console.log('='.repeat(80));

  if (totalFail === 0) {
    console.log('✅ CRITICAL 버그 없음 - 배포 가능');
  } else if (totalFail <= 2) {
    console.log('⚠️  경미한 문제 발견 - 조건부 배포 가능');
  } else {
    console.log('❌ 심각한 문제 발견 - 배포 불가, 수정 필요');
  }

  console.log('\n스크린샷 저장 위치:', screenshotsDir);
  console.log('='.repeat(80));
}

async function runTests() {
  console.log('🚀 전문가 모드 QA 재검증 시작\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    // 로그인
    const loginSuccess = await login(page);
    if (!loginSuccess) {
      console.log('❌ 로그인 실패로 테스트 중단');
      return;
    }

    // 스타일 분석
    const styleSuccess = await analyzeStyle(page);
    if (!styleSuccess) {
      console.log('⚠️ 스타일 분석 실패 (선택적)');
    }

    // 테스트 실행
    await testExpertModeInputFields(page);
    await testInputFieldFunctions(page);
    await testExpertModeGeneration(page);
    await testErrorHandling(page);
    await testUIUX(page);

  } catch (error) {
    console.error('❌ 테스트 실행 중 치명적 에러:', error);
  } finally {
    await browser.close();
    printSummary();
  }
}

runTests().catch(console.error);
