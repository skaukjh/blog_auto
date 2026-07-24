/**
 * 네이버 블로그 글쓰기 - 사람처럼 순차 입력
 *
 * 완성된 글을 한 번에 붙여넣는 대신, 스마트에디터 ONE에 사람이 타이핑하듯
 * 한 글자씩 넣습니다. 문장 끝과 문단 사이에는 실제로 생각하는 만큼의 간격을 둡니다.
 *
 * ⚠️ 이 모듈은 발행까지 자동으로 하지 않는 것을 기본값으로 둡니다.
 *    타이핑이 끝나면 에디터를 열어 둔 채 멈추고, 검토와 발행은 사람이 합니다.
 *    `autoPublish: true`를 명시해야만 발행 버튼까지 누릅니다.
 *
 * ⚠️ 스마트에디터 ONE의 DOM은 네이버가 예고 없이 바꿉니다. 셀렉터는 모두
 *    다중 폴백으로 두었고, 어느 단계에서 실패했는지 로그로 남깁니다.
 */

/** 스마트에디터 ONE 본문 영역을 식별하는 셀렉터 (앞에서부터 시도) */
const EDITOR_ROOT_SELECTORS = [
  '.se-content',
  '.se-viewer',
  'div[class*="se-container"]',
];

/** 제목 입력 영역 셀렉터 (앞에서부터 시도) */
const TITLE_SELECTORS = [
  '.se-documentTitle .se-text-paragraph',
  '.se-documentTitle [contenteditable="true"]',
  '.se-section-documentTitle .se-text-paragraph',
  'div[class*="documentTitle"] [contenteditable="true"]',
];

/** 본문 입력 영역 셀렉터 (앞에서부터 시도) */
const BODY_SELECTORS = [
  '.se-component.se-text .se-text-paragraph',
  '.se-section-text .se-text-paragraph',
  '.se-content [contenteditable="true"]',
  'div[class*="se-text"] [contenteditable="true"]',
];

/** 발행 버튼 셀렉터 (앞에서부터 시도) */
const PUBLISH_BUTTON_SELECTORS = [
  'button.publish_btn__m9KHH',
  'button[class*="publish_btn"]',
  '.se-publish-button',
  'button:has-text("발행")',
];

/** 발행 레이어의 최종 확인 버튼 */
const PUBLISH_CONFIRM_SELECTORS = [
  'button.confirm_btn__WEaBq',
  'button[class*="confirm_btn"]',
  '.layer_btn_area button:has-text("발행")',
];

export interface WritePostOptions {
  /** 글 제목 */
  title: string;
  /** 본문. 빈 줄로 문단을 구분합니다 */
  content: string;
  /** 글자 하나당 기본 입력 간격(ms). 기본 55 */
  charDelayMs?: number;
  /** 문장이 끝날 때 추가로 쉬는 시간 범위(ms). 기본 250~900 */
  sentencePauseMs?: [number, number];
  /** 문단 사이에 쉬는 시간 범위(ms). 기본 900~2200 */
  paragraphPauseMs?: [number, number];
  /** [IMAGE_N] 마커를 지우고 입력할지 여부. 기본 false (그대로 입력) */
  stripImageMarkers?: boolean;
  /** 타이핑이 끝나면 발행까지 할지 여부. 기본 false */
  autoPublish?: boolean;
}

export interface WritePostResult {
  success: boolean;
  /** 실제로 입력한 글자 수 (제목 + 본문) */
  typedChars: number;
  /** 타이핑에 걸린 시간(ms) */
  elapsedMs: number;
  /** 발행까지 완료됐는지 */
  published: boolean;
  /** 에디터 페이지 URL */
  editorUrl?: string;
  /** 치명적이지는 않지만 사람이 확인해야 하는 사항 */
  warnings: string[];
  error?: string;
}

/** min~max 사이 정수 난수 */
function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** 지정 시간만큼 대기 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 본문을 문단 → 문장 단위로 쪼갭니다.
 *
 * 문단은 빈 줄(\n\n) 기준이고, 문장은 종결부호(. ! ?) 뒤에서 끊습니다.
 * 종결부호를 문장에 포함시켜야 타이핑 결과가 원본과 같아집니다.
 */
export function splitIntoParagraphs(content: string): string[][] {
  return content
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\n/g, ' ').trim())
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph) => {
      const sentences = paragraph.match(/[^.!?]+[.!?]*\s*/g);
      return sentences ? sentences.filter((s) => s.trim().length > 0) : [paragraph];
    });
}

/**
 * 스마트에디터가 들어 있는 프레임을 찾습니다.
 *
 * 네이버는 접근 경로에 따라 에디터를 iframe 안에 넣기도 하고 최상위 문서에
 * 그대로 그리기도 합니다. 두 경우를 모두 처리하려고 전체 프레임을 훑습니다.
 */
async function findEditorFrame(page: any, timeoutMs = 30000): Promise<any> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      for (const selector of EDITOR_ROOT_SELECTORS) {
        try {
          const count = await frame.locator(selector).count();
          if (count > 0) {
            console.log(
              `[PostWriter] 에디터 프레임 발견 (셀렉터: ${selector}, URL: ${frame.url().substring(0, 60)})`
            );
            return frame;
          }
        } catch {
          // 프레임이 이동 중이면 조회가 실패합니다. 다음 후보로 넘어갑니다.
        }
      }
    }
    await sleep(500);
  }

  throw new Error(
    '스마트에디터를 찾지 못했습니다. 네이버가 에디터 구조를 바꿨거나 글쓰기 페이지가 열리지 않았습니다.'
  );
}

/**
 * 글쓰기 진입 시 뜨는 팝업들을 닫습니다.
 *
 * - "작성 중인 글이 있습니다" 임시저장 복구 팝업 → 취소 (새 글로 시작)
 * - 도움말/공지 레이어 → 닫기
 *
 * 팝업이 없는 것이 정상이므로 실패해도 진행합니다.
 */
async function dismissPopups(frame: any, warnings: string[]): Promise<void> {
  // 임시저장 복구 팝업: '취소'를 눌러야 빈 글로 시작합니다.
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
        console.log(`[PostWriter] 임시저장 복구 팝업을 닫았습니다 (${selector})`);
        warnings.push('임시저장된 글이 있어 "취소"를 눌러 새 글로 시작했습니다.');
        await sleep(800);
        break;
      }
    } catch {
      // 팝업이 없으면 정상입니다.
    }
  }

  // 도움말 레이어
  const closeSelectors = [
    '.se-help-panel-close-button',
    'button.se-utils-close',
    '.se-layer-close',
  ];

  for (const selector of closeSelectors) {
    try {
      const button = frame.locator(selector).first();
      if (await button.isVisible({ timeout: 1000 })) {
        await button.click();
        console.log(`[PostWriter] 도움말 레이어를 닫았습니다 (${selector})`);
        await sleep(500);
      }
    } catch {
      // 없으면 정상입니다.
    }
  }
}

/** 여러 후보 셀렉터 중 실제로 보이는 첫 번째 요소를 반환합니다 */
async function findFirstVisible(
  frame: any,
  selectors: string[],
  label: string,
  timeoutMs = 15000
): Promise<any> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    for (const selector of selectors) {
      try {
        const element = frame.locator(selector).first();
        if (await element.isVisible({ timeout: 1000 })) {
          console.log(`[PostWriter] ${label} 영역 발견 (${selector})`);
          return element;
        }
      } catch {
        // 다음 후보로
      }
    }
    await sleep(500);
  }

  throw new Error(`${label} 입력 영역을 찾지 못했습니다. 셀렉터 확인이 필요합니다.`);
}

/**
 * 단어를 고민하는 것처럼, 잠깐 다른 짧은 말을 썼다가 지우는 데 쓰는 후보입니다.
 * (순차입력기 exe의 naver-typer.cjs와 동일한 방식)
 */
const HESITATION_WORDS = ['좀 ', '약간 ', '조금 ', '뭔가 ', '그 ', '이제 ', '살짝 '];

/** 글자들을 하나씩, 딜레이를 흔들어 가며 칩니다 */
async function typeChars(page: any, text: string, baseDelayMs: number): Promise<void> {
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
 * - 가끔 엉뚱한 짧은 단어를 썼다가 지우고 원래 단어를 씁니다 (단어를 고르며 고쳐 쓰는 느낌)
 */
async function typeSentence(page: any, sentence: string, baseDelayMs: number): Promise<void> {
  // 단어 단위로 나눕니다. 뒤따르는 공백을 단어에 붙여 그대로 재현합니다.
  const words = sentence.match(/\S+\s*/g) || [sentence];

  for (let w = 0; w < words.length; w++) {
    // 가끔(3%) 다른 짧은 단어를 썼다가 지우고 원래 단어를 씁니다.
    if (w > 0 && w < words.length - 1 && Math.random() < 0.03) {
      const wrong = HESITATION_WORDS[randomBetween(0, HESITATION_WORDS.length - 1)];
      await typeChars(page, wrong, baseDelayMs);
      await sleep(randomBetween(300, 700)); // "아, 이 말이 아닌데" 하는 순간
      for (let k = 0; k < wrong.length; k++) {
        await page.keyboard.press('Backspace');
        await sleep(randomBetween(30, 90));
      }
      await sleep(randomBetween(200, 500));
      // 이어서 아래 일반 타이핑으로 원래 단어를 칩니다.
    }

    // 일반 단어 타이핑 (원래 단어)
    await typeChars(page, words[w], baseDelayMs);

    // 단어 사이에서 가끔(4%) 잠깐 멈춥니다 (글자 중간이 아니라 단어 경계).
    if (w > 0 && w < words.length - 1 && Math.random() < 0.04) {
      await sleep(randomBetween(600, 1400));
    }
  }
}

/**
 * 완성된 글을 네이버 글쓰기 화면에 순차 입력합니다.
 *
 * @param page   이미 네이버에 로그인된 Playwright 페이지
 * @param blogId 내 블로그 아이디
 */
export async function writePostSequentially(
  page: any,
  blogId: string,
  options: WritePostOptions
): Promise<WritePostResult> {
  const {
    title,
    content,
    charDelayMs = 55,
    stripImageMarkers = false,
    autoPublish = false,
  } = options;

  const warnings: string[] = [];
  const startedAt = Date.now();
  let typedChars = 0;

  try {
    if (!title.trim()) throw new Error('제목이 비어 있습니다.');
    if (!content.trim()) throw new Error('본문이 비어 있습니다.');

    // 이미지 마커 처리
    let bodyText = content;
    if (stripImageMarkers) {
      bodyText = bodyText.replace(/\[IMAGE_\d+\]/g, '').replace(/[ \t]{2,}/g, ' ');
    } else {
      const markerCount = (content.match(/\[IMAGE_\d+\]/g) || []).length;
      if (markerCount > 0) {
        warnings.push(
          `[IMAGE_N] 마커 ${markerCount}개를 그대로 입력했습니다. 발행 전에 해당 위치에 사진을 넣고 마커를 지우세요.`
        );
      }
    }

    // 1) 글쓰기 페이지 진입
    const writeUrl = `https://blog.naver.com/${blogId}/postwrite`;
    console.log(`[PostWriter] 글쓰기 페이지 이동: ${writeUrl}`);
    await page.goto(writeUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(4000); // 에디터 스크립트가 뜰 시간

    // 2) 에디터 프레임 확보 + 팝업 정리
    const frame = await findEditorFrame(page);
    await dismissPopups(frame, warnings);

    // 3) 제목 입력
    console.log(`[PostWriter] 제목 입력 시작 (${title.length}자)`);
    const titleElement = await findFirstVisible(frame, TITLE_SELECTORS, '제목');
    await titleElement.click();
    await sleep(randomBetween(400, 900));
    await typeSentence(page, title.trim(), charDelayMs);
    typedChars += title.trim().length;
    await sleep(randomBetween(800, 1600));

    // 4) 본문 입력
    const paragraphs = splitIntoParagraphs(bodyText);
    const totalSentences = paragraphs.reduce((sum, p) => sum + p.length, 0);
    console.log(
      `[PostWriter] 본문 입력 시작 (문단 ${paragraphs.length}개 / 문장 ${totalSentences}개)`
    );

    const bodyElement = await findFirstVisible(frame, BODY_SELECTORS, '본문');
    await bodyElement.click();
    await sleep(randomBetween(500, 1200));

    for (let p = 0; p < paragraphs.length; p++) {
      const sentences = paragraphs[p];

      for (const sentence of sentences) {
        await typeSentence(page, sentence, charDelayMs);
        typedChars += sentence.length;
        // 문장이 끝나면 무조건 줄을 바꿉니다 (순차입력기 exe와 동일).
        await page.keyboard.press('Enter');
        // 문장 사이 간격.
        await sleep(randomBetween(1000, 2000));
      }

      // 문단이 바뀔 때는 빈 줄을 하나 더 넣어 문단을 구분합니다.
      if (p < paragraphs.length - 1) {
        await page.keyboard.press('Enter');
        await sleep(randomBetween(1500, 3000));
      }

      const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
      console.log(
        `[PostWriter] 문단 ${p + 1}/${paragraphs.length} 완료 (${typedChars}자, ${elapsedSec}초 경과)`
      );
    }

    // 5) 발행 (기본값은 하지 않음)
    let published = false;
    if (autoPublish) {
      console.log('[PostWriter] 발행 시작');
      await sleep(randomBetween(2000, 4000));

      try {
        const publishButton = await findFirstVisible(
          frame,
          PUBLISH_BUTTON_SELECTORS,
          '발행 버튼',
          10000
        );
        await publishButton.click();
        await sleep(2000);

        const confirmButton = await findFirstVisible(
          frame,
          PUBLISH_CONFIRM_SELECTORS,
          '발행 확인 버튼',
          10000
        );
        await confirmButton.click();
        await sleep(5000);
        published = true;
        console.log('[PostWriter] 발행 완료');
      } catch (publishError) {
        const message =
          publishError instanceof Error ? publishError.message : '알 수 없는 오류';
        warnings.push(`본문 입력은 끝났지만 발행에 실패했습니다: ${message}`);
        console.warn('[PostWriter] 발행 실패:', message);
      }
    } else {
      warnings.push(
        '자동 발행을 하지 않았습니다. 열려 있는 브라우저에서 내용을 확인하고 직접 발행하세요.'
      );
    }

    return {
      success: true,
      typedChars,
      elapsedMs: Date.now() - startedAt,
      published,
      editorUrl: page.url(),
      warnings,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('[PostWriter] 오류:', message);

    return {
      success: false,
      typedChars,
      elapsedMs: Date.now() - startedAt,
      published: false,
      editorUrl: (() => {
        try {
          return page.url();
        } catch {
          return undefined;
        }
      })(),
      warnings,
      error: message,
    };
  }
}
