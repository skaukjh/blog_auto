/**
 * 네이버 블로그 순차 입력 엔진
 *
 * automation/lib/naver/post-writer.ts 와 같은 동작을 하지만, Electron 메인
 * 프로세스에서 돌아가도록 CommonJS로 옮겼습니다. 두 프로젝트는 코드를
 * 공유하지 않고 각자 사본을 가집니다 (저장소 규칙).
 *
 * 브라우저는 Playwright가 내려받은 Chromium이 아니라 **시스템에 설치된 크롬**을
 * 씁니다(channel: 'chrome'). 그래야 exe에 300MB짜리 브라우저를 넣지 않아도 되고,
 * 평소 쓰던 크롬이라 네이버 쪽에서도 덜 낯설게 봅니다.
 */
const { chromium } = require('playwright-core');

/** 스마트에디터 ONE 본문 영역 식별 (앞에서부터 시도) */
const EDITOR_ROOT_SELECTORS = ['.se-content', '.se-viewer', 'div[class*="se-container"]'];

const TITLE_SELECTORS = [
  '.se-documentTitle .se-text-paragraph',
  '.se-documentTitle [contenteditable="true"]',
  '.se-section-documentTitle .se-text-paragraph',
  'div[class*="documentTitle"] [contenteditable="true"]',
];

const BODY_SELECTORS = [
  '.se-component.se-text .se-text-paragraph',
  '.se-section-text .se-text-paragraph',
  '.se-content [contenteditable="true"]',
  'div[class*="se-text"] [contenteditable="true"]',
];

/** 네이버 로그인 화면의 아이디/비밀번호 입력칸 (앞에서부터 시도) */
const LOGIN_ID_SELECTORS = ['#id', 'input[name="id"]', 'input[id="id"]'];
const LOGIN_PW_SELECTORS = ['#pw', 'input[name="pw"]', 'input[id="pw"]'];

/**
 * 네이버 로그인 버튼 (앞에서부터 시도).
 *
 * 2026-07 기준 실제 DOM을 조사한 셀렉터입니다(node inspect-login.cjs).
 * 네이버는 반응형이라 `#loginBtn_row`(가로) / `#loginBtn_column`(세로) 두 버튼이
 * 모두 DOM에 있고 화면 크기에 따라 하나만 보입니다.
 *
 * ⚠️ 같은 화면에 "패스키 로그인"(#passkeyBtn_*) 버튼도 있고 class가 똑같이
 *    `btn_done`이라, has-text("로그인")를 쓰면 패스키 버튼을 눌러 로그인이
 *    안 됩니다. 그래서 정확히 "로그인"인 것(text-is)만, id로 먼저 잡습니다.
 */
const LOGIN_BUTTON_SELECTORS = [
  '#loginBtn_row',
  '#loginBtn_column',
  'button[id^="loginBtn"]',
  'button.btn_done:text-is("로그인")',
  'button:text-is("로그인")',
];

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 글쓰기 화면 주소를 정합니다.
 *
 * 사용자가 URL을 넣었으면 그걸 우선하고, 비워 뒀으면 아이디로 만듭니다.
 * 넣는 주소는 세 가지 형태를 모두 받습니다.
 *   - 글쓰기 주소 그대로      https://blog.naver.com/아이디/postwrite
 *   - 블로그 홈 주소          https://blog.naver.com/아이디
 *   - 글 주소                 https://blog.naver.com/아이디/223456789
 * 앞의 두세 경우 모두 /postwrite 로 바꿔 줍니다.
 */
function resolveWriteUrl(blogId, rawUrl) {
  const input = (rawUrl ?? '').trim();
  if (!input) return `https://blog.naver.com/${blogId}/postwrite`;

  let url;
  try {
    url = new URL(input.startsWith('http') ? input : `https://${input}`);
  } catch {
    throw new Error(`글쓰기 주소를 이해할 수 없습니다: ${input}`);
  }

  if (!/(^|\.)naver\.com$/.test(url.hostname)) {
    throw new Error('네이버 블로그 주소가 아닙니다. blog.naver.com 주소를 넣으세요.');
  }

  // PostWriteForm.naver?blogId=... 같은 구형 주소는 그대로 씁니다.
  if (/postwriteform/i.test(url.pathname)) return url.toString();

  const idFromPath = url.pathname.split('/').filter(Boolean)[0];
  const id = idFromPath || url.searchParams.get('blogId') || blogId;

  if (!id) throw new Error('주소에서 블로그 아이디를 찾지 못했습니다.');

  return `https://blog.naver.com/${id}/postwrite`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 본문을 문단 → 문장 단위로 쪼갭니다.
 * 문단은 빈 줄 기준, 문장은 종결부호(. ! ?) 뒤에서 끊습니다.
 */
function splitIntoParagraphs(content) {
  return content
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\n/g, ' ').trim())
    .filter((p) => p.length > 0)
    .map((p) => {
      const sentences = p.match(/[^.!?]+[.!?]*\s*/g);
      return sentences ? sentences.filter((s) => s.trim().length > 0) : [p];
    });
}

/** 에디터가 들어 있는 프레임을 찾습니다 (최상위 문서일 수도, iframe일 수도 있음) */
async function findEditorFrame(page, log, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      for (const selector of EDITOR_ROOT_SELECTORS) {
        try {
          if ((await frame.locator(selector).count()) > 0) {
            log(`에디터를 찾았습니다 (${selector})`);
            return frame;
          }
        } catch {
          // 프레임 이동 중이면 실패합니다. 다음 후보로 넘어갑니다.
        }
      }
    }
    await sleep(500);
  }

  throw new Error('스마트에디터를 찾지 못했습니다. 글쓰기 화면이 열렸는지 확인하세요.');
}

/** 진입 시 뜨는 팝업들을 닫습니다. 없으면 정상이므로 실패해도 진행합니다 */
async function dismissPopups(frame, log, warnings) {
  const cancelSelectors = [
    '.se-popup-button-cancel',
    'button.se-popup-button-cancel',
    '.se-popup-container button:has-text("취소")',
  ];

  for (const selector of cancelSelectors) {
    try {
      const button = frame.locator(selector).first();
      if (await button.isVisible({ timeout: 2000 })) {
        await button.click();
        log('임시저장 복구 팝업을 닫았습니다 (새 글로 시작)');
        warnings.push('임시저장된 글이 있어 "취소"를 눌러 새 글로 시작했습니다.');
        await sleep(800);
        break;
      }
    } catch {
      // 팝업 없음 - 정상
    }
  }

  for (const selector of ['.se-help-panel-close-button', 'button.se-utils-close', '.se-layer-close']) {
    try {
      const button = frame.locator(selector).first();
      if (await button.isVisible({ timeout: 1000 })) {
        await button.click();
        await sleep(500);
      }
    } catch {
      // 없음 - 정상
    }
  }
}

/** 후보 셀렉터 중 실제로 보이는 첫 요소를 반환 */
async function findFirstVisible(frame, selectors, label, log, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    for (const selector of selectors) {
      try {
        const element = frame.locator(selector).first();
        if (await element.isVisible({ timeout: 1000 })) {
          log(`${label} 입력 영역 확인 (${selector})`);
          return element;
        }
      } catch {
        // 다음 후보로
      }
    }
    await sleep(500);
  }

  throw new Error(`${label} 입력 영역을 찾지 못했습니다.`);
}

/**
 * page(또는 frame)에서 후보 셀렉터 중 실제로 보이는 첫 요소를 반환합니다.
 * findFirstVisible과 달리 로그인 화면(iframe 아님)에서 씁니다.
 */
async function firstVisibleLocator(page, selectors, label, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    for (const selector of selectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 800 })) {
          return element;
        }
      } catch {
        // 다음 후보로
      }
    }
    await sleep(400);
  }

  throw new Error(`${label}을(를) 찾지 못했습니다.`);
}

/** 글자들을 하나씩, 딜레이를 흔들어 가며 칩니다 */
async function typeChars(page, text, baseDelayMs) {
  for (const ch of text) {
    await page.keyboard.type(ch);
    // 글자별 딜레이를 크게 흔들어 한 박자로 안 보이게 합니다.
    await sleep(randomBetween(Math.round(baseDelayMs * 0.5), Math.round(baseDelayMs * 1.8)));
  }
}

/**
 * 문장 하나를 진짜 사람처럼 타이핑합니다.
 *
 * - 글자마다 딜레이가 제각각입니다 (한 박자로 치지 않음)
 * - 단어와 단어 사이에서 가끔 멈춥니다 (생각하는 것처럼)
 * - 가끔 2~3단어를 쓰다가 통째로 지우고 다시 씁니다 (실제로 고쳐 쓰는 느낌)
 *
 * @param baseDelayMs 사용자가 고른 속도. 글자별로 이 값의 0.5~1.8배로 흔듭니다.
 */
/**
 * 단어를 고민하는 것처럼, 잠깐 다른 짧은 말을 썼다가 지우는 데 쓰는 후보입니다.
 * 문맥과 무관하지만 짧아서 "어… 뭐라고 쓰지" 하는 망설임처럼 보입니다.
 */
const HESITATION_WORDS = ['좀 ', '약간 ', '조금 ', '뭔가 ', '그 ', '이제 ', '살짝 '];

async function typeSentence(page, sentence, baseDelayMs) {
  // 단어 단위로 나눕니다. 뒤따르는 공백을 단어에 붙여 그대로 재현합니다.
  const words = sentence.match(/\S+\s*/g) || [sentence];

  for (let w = 0; w < words.length; w++) {
    // 가끔(3%) 이 자리에서 "다른 단어를 썼다가 지우고" 원래 단어를 씁니다.
    // 사람이 단어를 고르며 고쳐 쓰는 모습입니다. 첫 단어와 끝 단어는 제외.
    if (w > 0 && w < words.length - 1 && Math.random() < 0.03) {
      // 1) 엉뚱한 짧은 단어를 먼저 씁니다.
      const wrong = HESITATION_WORDS[randomBetween(0, HESITATION_WORDS.length - 1)];
      await typeChars(page, wrong, baseDelayMs);
      await sleep(randomBetween(300, 700)); // "아, 이 말이 아닌데" 하는 순간

      // 2) 방금 친 만큼 지웁니다 (빠르게).
      for (let k = 0; k < wrong.length; k++) {
        await page.keyboard.press('Backspace');
        await sleep(randomBetween(30, 90));
      }
      await sleep(randomBetween(200, 500));
      // 이어서 아래 일반 타이핑으로 원래 단어(words[w])를 칩니다.
    }

    // 일반 단어 타이핑 (원래 단어)
    await typeChars(page, words[w], baseDelayMs);

    // 단어 사이에서 가끔(4%) 잠깐 멈춥니다 (다음 말을 고르듯). 글자 중간이 아니라 단어 경계.
    if (w > 0 && w < words.length - 1 && Math.random() < 0.04) {
      await sleep(randomBetween(600, 1400));
    }
  }
}

/**
 * 네이버에 로그인하고 글을 순차 입력합니다.
 *
 * @param {object}   options
 * @param {function} options.onProgress 진행 상황 콜백 ({ type, message, percent })
 * @param {function} options.shouldStop 중단 요청 여부를 돌려주는 함수
 */
async function typePost(options) {
  const {
    blogId,
    blogPassword,
    title,
    content,
    /** 글을 쓸 블로그 주소. 비우면 아이디로 만듭니다 */
    writeUrl: rawWriteUrl = '',
    charDelayMs = 55,
    stripImageMarkers = false,
    onProgress = () => {},
    shouldStop = () => false,
  } = options;

  const log = (message, percent) => onProgress({ type: 'log', message, percent });
  const warnings = [];
  const startedAt = Date.now();
  let browser = null;
  let browserAlive = true; // 사용자가 크롬 창을 직접 닫으면 false가 됩니다.
  let typedChars = 0;

  const checkStop = () => {
    if (shouldStop()) throw new Error('사용자가 중단했습니다.');
    if (!browserAlive) {
      throw new Error('크롬 창이 닫혀 작업을 멈췄습니다. 다시 시도해주세요.');
    }
  };

  try {
    if (!title.trim()) throw new Error('제목이 비어 있습니다.');
    if (!content.trim()) throw new Error('본문이 비어 있습니다.');

    // 주소는 브라우저를 띄우기 전에 검증합니다. 틀렸으면 창부터 뜨는 게 낭비입니다.
    const writeUrl = resolveWriteUrl(blogId, rawWriteUrl);

    let bodyText = content;
    if (stripImageMarkers) {
      bodyText = bodyText.replace(/\[IMAGE_\d+\]/g, '').replace(/[ \t]{2,}/g, ' ');
    } else {
      const markerCount = (content.match(/\[IMAGE_\d+\]/g) || []).length;
      if (markerCount > 0) {
        warnings.push(
          `[IMAGE_N] 마커 ${markerCount}개를 그대로 입력했습니다. 발행 전에 사진을 넣고 마커를 지우세요.`
        );
      }
    }

    // 1) 시스템 크롬 실행
    log('크롬을 실행합니다...', 2);
    browser = await chromium.launch({
      headless: false,
      channel: 'chrome',
      args: ['--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage'],
      // 프로그램(exe)을 꺼도 크롬 창은 그대로 남게 합니다.
      // Playwright가 프로세스 종료 시그널에 브라우저를 함께 닫지 않도록 막습니다.
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false,
    });

    // 사용자가 크롬 창을 직접 닫으면 즉시 알아채 멈추도록 합니다.
    browser.on('disconnected', () => {
      browserAlive = false;
    });

    const page = await browser.newPage();
    page.on('close', () => {
      browserAlive = false;
    });
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);

    // 2) 로그인
    log('네이버 로그인 페이지로 이동합니다...', 5);
    await page.goto('https://nid.naver.com/nidlogin.login', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    log('아이디와 비밀번호를 입력합니다...', 8);

    // 아이디/비밀번호 입력칸을 폴백으로 찾습니다.
    const idField = await firstVisibleLocator(page, LOGIN_ID_SELECTORS, '아이디 입력칸');
    await idField.click();
    await idField.fill(blogId, { delay: 80 });
    await sleep(500);

    const pwField = await firstVisibleLocator(page, LOGIN_PW_SELECTORS, '비밀번호 입력칸');
    await pwField.click();
    await pwField.fill(blogPassword, { delay: 80 });
    await sleep(500);

    // 로그인 버튼을 폴백으로 찾아 클릭합니다. 못 찾으면 비밀번호 칸에서 Enter로 제출합니다.
    log('로그인 버튼을 누릅니다...', 9);
    const loginButton = await firstVisibleLocator(
      page,
      LOGIN_BUTTON_SELECTORS,
      '로그인 버튼',
      5000
    ).catch(() => null);

    if (loginButton) {
      await loginButton.click();
    } else {
      log('로그인 버튼을 못 찾아 Enter로 제출합니다.');
      await pwField.press('Enter');
    }

    log('로그인 처리 중입니다. 2차 인증이 뜨면 크롬 창에서 직접 완료하세요 (최대 2분)', 10);

    let loginSuccess = false;
    for (let i = 0; i < 120 && !loginSuccess; i++) {
      checkStop();
      try {
        const url = page.url();
        if (!url.includes('nid.naver.com/nidlogin.login')) {
          loginSuccess = true;
          break;
        }
      } catch {
        // 페이지 이동 중
      }
      await sleep(1000);
    }

    if (!loginSuccess) {
      throw new Error('로그인에 실패했습니다. 아이디·비밀번호 또는 2차 인증을 확인하세요.');
    }

    log('로그인 성공', 12);
    await sleep(2000);

    // 3) 글쓰기 화면 진입
    checkStop();
    log(`글쓰기 화면을 엽니다: ${writeUrl}`, 15);
    await page.goto(writeUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await sleep(4000);

    const frame = await findEditorFrame(page, log);
    await dismissPopups(frame, log, warnings);

    // 4) 제목 입력
    checkStop();
    log(`제목을 입력합니다 (${title.trim().length}자)`, 18);
    const titleElement = await findFirstVisible(frame, TITLE_SELECTORS, '제목', log);
    await titleElement.click();
    await sleep(randomBetween(400, 900));
    await typeSentence(page, title.trim(), charDelayMs);
    typedChars += title.trim().length;
    await sleep(randomBetween(800, 1600));

    // 5) 본문 입력
    const paragraphs = splitIntoParagraphs(bodyText);
    const totalSentences = paragraphs.reduce((sum, p) => sum + p.length, 0);
    log(`본문을 입력합니다 (문단 ${paragraphs.length}개 / 문장 ${totalSentences}개)`, 20);

    const bodyElement = await findFirstVisible(frame, BODY_SELECTORS, '본문', log);
    await bodyElement.click();
    await sleep(randomBetween(500, 1200));

    let doneSentences = 0;

    for (let p = 0; p < paragraphs.length; p++) {
      for (const sentence of paragraphs[p]) {
        checkStop();
        await typeSentence(page, sentence, charDelayMs);
        typedChars += sentence.length;
        doneSentences++;

        // 20% ~ 98% 구간을 본문 진행률로 씁니다.
        const percent = 20 + Math.round((doneSentences / totalSentences) * 78);
        onProgress({
          type: 'progress',
          message: `${typedChars.toLocaleString()}자 입력 (문단 ${p + 1}/${paragraphs.length})`,
          percent,
        });

        // 문장이 끝나면 무조건 줄을 바꿉니다 (사용자 요청).
        await page.keyboard.press('Enter');

        // 문장 사이 간격 (사람이 다음 문장을 생각하듯 잠깐).
        await sleep(randomBetween(1000, 2000));
      }

      if (p < paragraphs.length - 1) {
        // 문단이 바뀔 때는 빈 줄을 하나 더 넣어 문단을 구분합니다.
        await page.keyboard.press('Enter');
        await sleep(randomBetween(1500, 3000));
      }
    }

    warnings.push(
      '자동 발행은 하지 않았습니다. 크롬 창에서 내용을 확인하고 직접 발행하세요.'
    );

    log('입력이 끝났습니다. 크롬 창에서 확인 후 발행하세요.', 100);

    return {
      success: true,
      typedChars,
      elapsedMs: Date.now() - startedAt,
      warnings,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    return {
      success: false,
      typedChars,
      elapsedMs: Date.now() - startedAt,
      warnings,
      error: message,
    };
  }
  // 브라우저는 일부러 닫지 않습니다.
  // 사용자가 내용을 확인하고 직접 발행해야 하기 때문입니다.
}

module.exports = { typePost, splitIntoParagraphs, resolveWriteUrl };
