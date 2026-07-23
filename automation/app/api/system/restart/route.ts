export const runtime = 'nodejs';

import { NextResponse } from 'next/server';

/**
 * 프로그램 재시작
 *
 * 서버 프로세스를 종료시키면 scripts/start-automation.bat 의 감시 루프가
 * 이를 감지해 자동으로 다시 띄웁니다. 따라서 이 라우트는 "종료"만 담당합니다.
 *
 * 감시 스크립트 없이 실행 중이라면 그냥 종료되고 다시 뜨지 않으므로,
 * 응답에 안내를 함께 내려줍니다.
 */
export async function POST() {
  const isLocal = process.env.NODE_ENV === 'development' || !process.env.VERCEL;

  if (!isLocal) {
    return NextResponse.json(
      { success: false, error: '로컬 환경에서만 사용할 수 있습니다.' },
      { status: 403 }
    );
  }

  console.log('[재시작] 요청을 받았습니다. 잠시 후 프로세스를 종료합니다.');

  // 응답이 클라이언트에 전달된 뒤 종료되도록 약간 지연시킵니다
  setTimeout(() => {
    console.log('[재시작] 프로세스를 종료합니다. 감시 스크립트가 다시 실행합니다.');
    process.exit(0);
  }, 500);

  return NextResponse.json({
    success: true,
    message: '재시작 중입니다. 약 10~20초 후 자동으로 다시 연결됩니다.',
  });
}
