/**
 * 순차 입력의 텍스트 분할 로직 검증
 *
 * 브라우저 없이 돌릴 수 있는 부분만 확인합니다.
 * 실행: npx tsx scripts/test-post-writer.ts
 */
import { splitIntoParagraphs } from '../lib/naver/post-writer';

let failed = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  OK   ${label}`);
  } else {
    failed++;
    console.log(`  FAIL ${label}\n       기대: ${e}\n       실제: ${a}`);
  }
}

console.log('[1] 문단·문장 분할');

const simple = splitIntoParagraphs('첫 문장이다. 둘째 문장이다.\n\n다른 문단이다.');
check('문단 수', simple.length, 2);
check('첫 문단 문장 수', simple[0].length, 2);
check('둘째 문단 내용', simple[1], ['다른 문단이다.']);

console.log('[2] 원문 보존 - 분할 후 합치면 원래 글자가 남아야 함');

const original =
  '퇴근길에 들렀다. 간판이 작았다.\n\n' +
  '[IMAGE_1] 안쪽은 좁았고 자리는 여섯 개뿐이었다! 그래도 좋았다?\n\n' +
  '다음에 또 가려 한다.';
const rejoined = splitIntoParagraphs(original)
  .map((sentences) => sentences.join(''))
  .join('\n');
const strip = (s: string) => s.replace(/\s+/g, '');
check('글자 보존', strip(rejoined), strip(original.replace(/\n\s*\n/g, '\n')));
check('마커 보존', /\[IMAGE_1\]/.test(rejoined), true);

console.log('[3] 가장자리 입력');

check('빈 문자열', splitIntoParagraphs(''), []);
check('공백만', splitIntoParagraphs('   \n\n   '), []);
check('종결부호 없는 한 줄', splitIntoParagraphs('종결부호가 없다'), [['종결부호가 없다']]);
check(
  '문단 내 단일 줄바꿈은 공백으로',
  splitIntoParagraphs('한 줄이다.\n이어지는 줄이다.')[0].length,
  2
);

console.log('[4] 마커 제거 규칙 (라우트가 쓰는 정규식과 동일)');

const strippedBody = '앞이다. [IMAGE_1] 뒤다.'
  .replace(/\[IMAGE_\d+\]/g, '')
  .replace(/[ \t]{2,}/g, ' ');
check('마커 제거 결과', strippedBody, '앞이다. 뒤다.');

console.log('');
if (failed > 0) {
  console.log(`실패 ${failed}건`);
  process.exit(1);
}
console.log('모두 통과');
