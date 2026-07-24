/**
 * 마이그레이션 004·005 가 적용됐는지 실제 REST 호출로 확인합니다.
 *
 * 사용: node automation/scripts/verify-migrations.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readEnv(path) {
  try {
    const out = {};
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2];
    }
    return out;
  } catch {
    return {};
  }
}

const env = { ...readEnv(join(repoRoot, '.env.local')), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Supabase 환경변수가 없습니다.');
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function check(label, path) {
  const res = await fetch(`${url}/rest/v1/${path}`, { headers });
  const body = await res.text();
  const ok = res.ok;
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label}`);
  if (!ok) {
    try {
      const j = JSON.parse(body);
      console.log(`       ${j.code ?? ''} ${j.message ?? body.slice(0, 120)}`);
    } catch {
      console.log(`       ${body.slice(0, 120)}`);
    }
  }
  return ok;
}

console.log('마이그레이션 004 - blog_styles 컬럼');
const a = await check('samples_hash 컬럼', 'blog_styles?select=samples_hash&limit=1');
const b = await check('samples 컬럼', 'blog_styles?select=samples&limit=1');

console.log('\n마이그레이션 005 - writing_guides 테이블');
const c = await check('writing_guides 테이블', 'writing_guides?select=guide_content&limit=1');

console.log('');
if (a && b && c) {
  console.log('전체 적용 완료.');
} else {
  console.log('일부 미적용. 위 FAIL 항목의 SQL을 실행하세요.');
  process.exitCode = 1;
}
