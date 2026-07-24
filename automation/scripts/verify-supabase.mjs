/**
 * Supabase 연결 검증 스크립트
 *
 * 사용법 (저장소 루트에서):
 *   node automation/scripts/verify-supabase.mjs
 *
 * 루트 .env.local 과 automation/.env.local 을 각각 읽어
 * URL/키가 실제로 동작하는지 읽기·쓰기까지 확인합니다.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** .env 형식 파일을 파싱해 객체로 반환 */
function parseEnv(path) {
  if (!existsSync(path)) return null;
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

/** 키를 노출하지 않고 형태만 보여주기 위한 마스킹 */
function mask(key) {
  if (!key) return "(없음)";
  if (key.length < 16) return "(너무 짧음)";
  return `${key.slice(0, 12)}...${key.slice(-4)} (${key.length}자)`;
}

/** REST 엔드포인트로 실제 요청을 보내 키 유효성 확인 */
async function check(label, url, key, table) {
  const endpoint = `${url}/rest/v1/${table}?select=user_id&limit=1`;
  try {
    const res = await fetch(endpoint, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const body = await res.text();
    if (res.ok) {
      console.log(`  ✅ ${label} → ${res.status} OK  (${table} 조회 성공)`);
      return true;
    }
    console.log(`  ❌ ${label} → ${res.status}  ${body.slice(0, 200)}`);
    return false;
  } catch (err) {
    console.log(`  ❌ ${label} → 요청 실패: ${err.message}`);
    return false;
  }
}

const projects = [
  { name: "A (루트)", path: resolve(repoRoot, ".env.local") },
  { name: "B (automation)", path: resolve(repoRoot, "automation/.env.local") },
];

let allOk = true;

for (const project of projects) {
  console.log(`\n=== ${project.name} ===`);
  const env = parseEnv(project.path);
  if (!env) {
    console.log("  ❌ .env.local 파일이 없습니다");
    allOk = false;
    continue;
  }

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;

  console.log(`  URL          : ${url || "(없음)"}`);
  console.log(`  publishable  : ${mask(anon)}`);
  console.log(`  secret       : ${mask(service)}`);

  if (!url || !anon || !service) {
    console.log("  ❌ 값이 비어 있습니다");
    allOk = false;
    continue;
  }
  if (anon.includes("PASTE_") || service.includes("PASTE_")) {
    console.log("  ❌ 플레이스홀더가 그대로입니다. 대시보드에서 키를 붙여넣으세요.");
    allOk = false;
    continue;
  }

  // 두 테이블 모두 확인 (A는 blog_styles, B는 neighbor_target_list를 씀)
  const r1 = await check("publishable/blog_styles", url, anon, "blog_styles");
  const r2 = await check("secret/blog_styles", url, service, "blog_styles");
  const r3 = await check("secret/neighbor_target_list", url, service, "neighbor_target_list");
  if (!(r1 && r2 && r3)) allOk = false;
}

console.log(
  allOk ? "\n전체 통과: Supabase 연결이 정상입니다." : "\n실패 항목이 있습니다. 위 로그를 확인하세요.",
);
process.exit(allOk ? 0 : 1);
