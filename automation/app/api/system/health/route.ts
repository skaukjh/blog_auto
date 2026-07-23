export const runtime = 'nodejs';

import { NextResponse } from 'next/server';

/** 서버 생존 확인용. 재시작 후 복구 감지에 사용합니다. */
export async function GET() {
  return NextResponse.json({ ok: true, startedAt: process.uptime() });
}
