/**
 * 글쓰기 주소 해석 로직 검증. 브라우저 없이 돌아갑니다.
 * 사용: node test-url.cjs
 */
const { resolveWriteUrl } = require('./lib/naver-typer.cjs');

let failed = 0;

function check(label, actual, expected) {
  if (actual === expected) {
    console.log(`  OK   ${label}`);
  } else {
    failed++;
    console.log(`  FAIL ${label}\n       기대: ${expected}\n       실제: ${actual}`);
  }
}

function checkThrows(label, fn) {
  try {
    fn();
    failed++;
    console.log(`  FAIL ${label} — 오류가 나야 하는데 통과했습니다`);
  } catch {
    console.log(`  OK   ${label}`);
  }
}

const WRITE = 'https://blog.naver.com/myblog/postwrite';

console.log('[1] 주소를 비웠을 때 - 아이디로 구성');
check('빈 문자열', resolveWriteUrl('myblog', ''), WRITE);
check('undefined', resolveWriteUrl('myblog', undefined), WRITE);
check('공백만', resolveWriteUrl('myblog', '   '), WRITE);

console.log('[2] 여러 형태의 주소를 글쓰기 주소로 변환');
check('글쓰기 주소 그대로', resolveWriteUrl('other', WRITE), WRITE);
check('블로그 홈 주소', resolveWriteUrl('other', 'https://blog.naver.com/myblog'), WRITE);
check('끝에 슬래시', resolveWriteUrl('other', 'https://blog.naver.com/myblog/'), WRITE);
check('개별 글 주소', resolveWriteUrl('other', 'https://blog.naver.com/myblog/223456789'), WRITE);
check('http 프로토콜', resolveWriteUrl('other', 'http://blog.naver.com/myblog'), WRITE);
check('프로토콜 생략', resolveWriteUrl('other', 'blog.naver.com/myblog'), WRITE);
check('m.blog 모바일', resolveWriteUrl('other', 'https://m.blog.naver.com/myblog'), WRITE);

console.log('[3] 주소가 아이디보다 우선');
check('아이디와 주소가 다르면 주소를 따름', resolveWriteUrl('아이디무시', 'https://blog.naver.com/myblog'), WRITE);

console.log('[4] 잘못된 입력은 거부');
checkThrows('네이버가 아닌 도메인', () => resolveWriteUrl('myblog', 'https://example.com/abc'));
checkThrows('도메인만 있고 아이디 없음', () => resolveWriteUrl('', 'https://blog.naver.com/'));

console.log('');
if (failed > 0) {
  console.log(`실패 ${failed}건`);
  process.exit(1);
}
console.log('모두 통과');
