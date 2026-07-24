/**
 * 참고 자료를 한 번 분석해 "글쓰기 가이드"를 만들고 Supabase에 저장합니다.
 *
 * 왜 로컬 스크립트인가:
 *   전자책 PDF가 22MB라 Vercel에 올릴 수 없고, 올릴 이유도 없습니다.
 *   분석은 한 번만 하면 되고, 결과만 Supabase에 있으면 글 생성이 동작합니다.
 *
 * 무엇을 뽑는가:
 *   글의 구조·구성·필수 포함 요소 같은 "포맷" 규칙만 뽑습니다.
 *   종결어미와 말투는 의도적으로 제외합니다. 그건 /format 이 학습한 문체
 *   (blog_styles)가 담당하며, 참고 자료의 문체 지침이 그걸 덮어쓰면 안 됩니다.
 *
 * ⚠️ 원본은 제3자 저작물입니다. 원문을 저장하지 않고 규칙 요약만 저장합니다.
 *
 * 사용:
 *   node scripts/extract-pdf.mjs            # 먼저 PDF에서 텍스트 추출
 *   node scripts/analyze-writing-guide.mjs  # 분석 + 저장
 *   node scripts/analyze-writing-guide.mjs --force   # 자료가 그대로여도 재분석
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

/** 참고할 웹 자료 */
const SOURCE_URLS = ['https://incredible-gingersnap-568cb9.netlify.app/'];

/** 청크 하나에 넣을 글자 수. 한글은 대략 1.5자/토큰이라 넉넉하게 잡습니다 */
const CHUNK_SIZE = 40000;

const MODEL = 'gpt-5.6-sol';
const EXTRACTED_DIR = join('docs', '.extracted');

// ---------------------------------------------------------------- 환경변수

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

const env = { ...readEnv('.env.local'), ...process.env };
const force = process.argv.includes('--force');

for (const key of ['OPENAI_API_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!env[key]) {
    console.error(`${key} 가 없습니다. .env.local 을 확인하세요.`);
    process.exit(1);
  }
}

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// ---------------------------------------------------------------- 자료 수집

/** HTML에서 대략적인 본문 텍스트만 남깁니다 */
function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

const sources = [];

// 1) PDF 추출본
if (existsSync(EXTRACTED_DIR)) {
  for (const name of readdirSync(EXTRACTED_DIR).filter((f) => f.endsWith('.txt'))) {
    const text = readFileSync(join(EXTRACTED_DIR, name), 'utf8');
    sources.push({ label: `PDF: ${name.replace(/\.txt$/, '')}`, text });
    console.log(`자료 추가 - ${name} (${text.length.toLocaleString()}자)`);
  }
}

// 2) 웹 자료
for (const url of SOURCE_URLS) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = htmlToText(await res.text());
    sources.push({ label: `URL: ${url}`, text });
    console.log(`자료 추가 - ${url} (${text.length.toLocaleString()}자)`);
  } catch (err) {
    console.warn(`URL 가져오기 실패 (${url}): ${err.message}`);
  }
}

if (sources.length === 0) {
  console.error('분석할 자료가 없습니다. 먼저 node scripts/extract-pdf.mjs 를 실행하세요.');
  process.exit(1);
}

// ---------------------------------------------------------------- 지문 비교

const sourcesHash = createHash('sha256')
  .update(sources.map((s) => `${s.label}\n${s.text}`).join('\n---\n'))
  .digest('hex');

if (!force) {
  const { data } = await supabase
    .from('writing_guides')
    .select('sources_hash, analyzed_at')
    .eq('user_id', 'default')
    .maybeSingle();

  if (data?.sources_hash === sourcesHash) {
    console.log(`\n자료가 지난번과 같습니다. 재분석하지 않습니다.`);
    console.log(`  마지막 분석: ${data.analyzed_at}`);
    console.log(`  강제로 다시 하려면 --force 를 붙이세요.`);
    process.exit(0);
  }
}

// ---------------------------------------------------------------- 분석

const CHUNK_INSTRUCTION = `당신은 블로그 글쓰기 교재를 분석하는 편집자입니다.
아래는 한국어 블로그 운영·글쓰기 교재의 일부입니다.

여기서 **글을 어떤 구조로 쓰는가**에 해당하는 실행 가능한 규칙만 뽑아내세요.

반드시 포함할 것:
- 글의 뼈대 (도입-본문-마무리 구성, 소주제 개수와 배치)
- 문단 길이, 문단 수, 소제목 사용 규칙
- 반드시 넣어야 하는 요소 (구체적 수치, 가격, 시간, 거리, 동선, 비교, 장단점 등)
- 경험을 드러내는 방법 (시제, 사례 제시 방식)
- 상황별 추천, 요약본 배치 같은 구성 장치
- 검색 노출을 의식한 키워드 배치 규칙
- 피해야 할 것 (금지 표현, 흔한 실수)

반드시 제외할 것:
- 종결어미와 말투 지침 ("~했어요", "~합니다" 같은 어미 규칙) — 이건 별도 시스템이 담당합니다
- 블로그 개설, 수익 정산, 광고 단가, 플랫폼 가입 절차 같은 운영·수익화 이야기
- 교재의 서사, 저자 소개, 후기, 홍보 문구
- 원문 문장 그대로의 인용 (반드시 규칙으로 재서술하세요)

해당 내용이 없으면 "없음"이라고만 답하세요.
한국어로, 번호 매긴 짧은 규칙 목록으로 출력하세요.`;

function chunkText(text, size) {
  const chunks = [];
  for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
  return chunks;
}

const partials = [];

for (const source of sources) {
  const chunks = chunkText(source.text, CHUNK_SIZE);
  console.log(`\n분석: ${source.label} (청크 ${chunks.length}개)`);

  for (const [i, chunk] of chunks.entries()) {
    process.stdout.write(`  청크 ${i + 1}/${chunks.length} ... `);

    const res = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: CHUNK_INSTRUCTION },
        { role: 'user', content: chunk },
      ],
    });

    const out = res.choices[0]?.message?.content?.trim() ?? '';
    if (out && out !== '없음') {
      partials.push(out);
      console.log(`${out.length}자`);
    } else {
      console.log('건너뜀');
    }
  }
}

console.log(`\n부분 결과 ${partials.length}개를 하나로 정리합니다...`);

const MERGE_INSTRUCTION = `아래는 같은 블로그 글쓰기 교재를 여러 조각으로 나눠 분석한 결과입니다.
중복을 제거하고 서로 충돌하는 규칙을 정리해, 하나의 실행 가능한 글쓰기 가이드로 합치세요.

출력 형식 (이 순서와 제목을 그대로 쓰세요):

1. 글의 구조
2. 문단과 소제목 규칙
3. 반드시 포함할 요소
4. 경험을 드러내는 방법
5. 검색 노출을 위한 키워드 배치
6. 마무리 구성
7. 피해야 할 것

규칙:
- 각 항목은 짧은 명령문으로 씁니다. 설명이나 이유는 넣지 마세요.
- 구체적인 수치(문단 수, 소주제 개수 등)가 있으면 반드시 살리세요.
- 종결어미·말투 규칙도 자료에 있으면 포함하세요.
- 전체 2500자를 넘기지 마세요.
- 한국어로 작성하세요.`;

const merged = await openai.chat.completions.create({
  model: MODEL,
  messages: [
    { role: 'system', content: MERGE_INSTRUCTION },
    { role: 'user', content: partials.join('\n\n---\n\n') },
  ],
});

const guide = merged.choices[0]?.message?.content?.trim() ?? '';

if (!guide) {
  console.error('가이드 생성에 실패했습니다.');
  process.exit(1);
}

console.log(`\n생성된 가이드 (${guide.length}자):\n`);
console.log('─'.repeat(70));
console.log(guide);
console.log('─'.repeat(70));

// ---------------------------------------------------------------- 종결어미 판정
//
// 사용자 결정(2026-07-24): 이 자료의 권장 문체가 학습된 전문가 문체의 종결어미까지
// 덮어씁니다. 그래서 "이 자료가 권장하는 종결어미"를 판정해 함께 저장합니다.
// 자료 본문이 아니라 자료가 '권장하는' 어미를 봐야 하므로 모델에게 직접 묻습니다.

console.log('\n권장 종결어미를 판정합니다...');

// ⚠️ 판정 근거는 '가이드'가 아니라 '원본 자료'입니다.
//   가이드는 "~하라/~마라" 같은 명령문으로 쓰여, 그걸 보면 어미를 오판합니다.
//   원본 자료가 블로그 독자에게 권하는 예시 문체("~했어요" 등)를 봐야 합니다.
const endingSource = sources.map((s) => s.text).join('\n\n').slice(0, 30000);

const endingRes = await openai.chat.completions.create({
  model: MODEL,
  messages: [
    {
      role: 'system',
      content: `아래는 블로그 글쓰기 교재·자료입니다. 이 자료가 **독자에게 이렇게 쓰라고
권장하는 블로그 본문의 종결어미**가 무엇인지 판단하세요.

주의: 자료 자체의 설명 문장 어미가 아니라, 자료가 "예시로 제시하거나 권하는
블로그 글"의 어미를 보세요. 예를 들어 "제목은 ~하세요", "본문은 ~했어요 형태로
쓰세요"처럼 권하는 문체가 판정 대상입니다.

- 권장 문체가 존댓말(해요체, "~했어요/~예요/~하세요")이면 "요"
- 권장 문체가 반말·문어체(해라체, "~했다/~한다/~이다")이면 "다"

반드시 "요" 또는 "다" 한 글자만 출력하세요. 다른 말은 하지 마세요.`,
    },
    { role: 'user', content: endingSource },
  ],
});

const rawEnding = (endingRes.choices[0]?.message?.content ?? '').trim();
const endingPattern = rawEnding.includes('다') ? '다' : rawEnding.includes('요') ? '요' : null;

console.log(`  판정 결과: ${endingPattern ?? '판정 실패(문체 강제 안 함)'}`);
if (endingPattern) {
  console.log(`  ⚠️ 모든 글이 ~~${endingPattern}체로 강제됩니다 (학습된 전문가 문체의 어미보다 우선)`);
}

// ---------------------------------------------------------------- 저장

const now = new Date().toISOString();

/** ending_pattern 컬럼이 없을 때(마이그레이션 006 미적용) 대비 */
async function save(includeEnding) {
  const row = {
    user_id: 'default',
    guide_content: guide,
    sources: sources.map((s) => s.label),
    sources_hash: sourcesHash,
    analyzed_at: now,
    updated_at: now,
  };
  if (includeEnding) row.ending_pattern = endingPattern;
  return supabase.from('writing_guides').upsert(row, { onConflict: 'user_id' });
}

let { error } = await save(true);
if (error && (error.code === '42703' || error.code === 'PGRST204' || /ending_pattern/.test(error.message))) {
  console.warn('\n⚠️ ending_pattern 컬럼이 없습니다. 마이그레이션 006을 적용하세요. 이번엔 종결어미 강제 없이 저장합니다.');
  ({ error } = await save(false));
}

if (error) {
  console.error('\nSupabase 저장 실패:', error.message);
  if (error.code === '42P01') {
    console.error('writing_guides 테이블이 없습니다. 마이그레이션 005를 먼저 실행하세요.');
  }
  process.exit(1);
}

console.log('\nSupabase 저장 완료. 이제 글 생성 시 이 가이드가 적용됩니다.');
