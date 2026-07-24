/**
 * supabase/migrations/*.sql 을 Supabase에 적용합니다.
 *
 * 사용: node automation/scripts/apply-migration.mjs 004
 *
 * Supabase REST에는 임의 SQL 실행 엔드포인트가 없어, Management API를 씁니다.
 * SUPABASE_ACCESS_TOKEN(개인 액세스 토큰)이 필요하며, 없으면 SQL을 출력만 하고
 * 대시보드 SQL Editor에 붙여넣도록 안내합니다.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');

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

const prefix = process.argv[2];
if (!prefix) {
  console.error('사용법: node automation/scripts/apply-migration.mjs <번호>  (예: 004)');
  process.exit(1);
}

const migrationsDir = join(repoRoot, 'supabase', 'migrations');
const file = readdirSync(migrationsDir).find((f) => f.startsWith(prefix));
if (!file) {
  console.error(`${prefix} 로 시작하는 마이그레이션을 찾지 못했습니다.`);
  process.exit(1);
}

const sql = readFileSync(join(migrationsDir, file), 'utf8');
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const ref = url?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
const token = env.SUPABASE_ACCESS_TOKEN;

console.log(`마이그레이션: ${file}`);
console.log(`프로젝트 ref: ${ref}`);

if (!token) {
  console.log('\nSUPABASE_ACCESS_TOKEN 이 없어 자동 적용을 건너뜁니다.');
  console.log('아래 SQL을 대시보드 SQL Editor에 붙여넣어 실행하세요.\n');
  console.log(`  https://supabase.com/dashboard/project/${ref}/sql/new\n`);
  console.log('─'.repeat(70));
  console.log(sql);
  console.log('─'.repeat(70));
  process.exit(2);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

const text = await res.text();
if (res.ok) {
  console.log(`\n적용 완료 (HTTP ${res.status})`);
} else {
  console.error(`\n적용 실패 (HTTP ${res.status}): ${text}`);
  process.exit(1);
}
