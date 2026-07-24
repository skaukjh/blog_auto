# CLAUDE.md

Claude Code(claude.ai/code)가 이 저장소에서 작업할 때 참고하는 문서입니다.

## 저장소 구성

이 저장소에는 **독립적인 세 개의 프로젝트**가 있습니다. 각각 별도의 `package.json`과 `node_modules`를 가지며, 서로 코드를 import하지 않습니다.

| | 위치 | 역할 | 배포 |
|---|---|---|---|
| **A** | 저장소 루트 | AI 블로그 글 생성 | Vercel |
| **B** | `automation/` | 네이버 블로그 이웃 자동화 + 글쓰기 순차 입력 | **로컬 전용** (Next.js, 포트 80) |
| **C** | `typing-app/` | 완성된 글을 네이버에 사람처럼 순차 입력 | **데스크톱 exe** (Electron) |

A와 B가 공유하는 것은 **Supabase의 `blog_styles` 테이블**입니다. 코드는 공유하지 않고, 각자 자기 사본(`lib/utils/style-storage.ts`, `lib/utils/blog-style-memory-cache.ts`)을 가집니다.

```
A: /format 분석  →  Supabase blog_styles (user_id="default")  →  B: 댓글 생성 시 문체 참조
```

즉 **A와 B가 같은 Supabase 프로젝트를 바라보도록 양쪽 `.env.local`의 Supabase 값을 동일하게 맞춰야 합니다.**

### B와 C의 관계 (둘 다 순차 입력 기능이 있음)

B(`automation/`)와 C(`typing-app/`) **모두** 완성된 글을 네이버 글쓰기 화면에 사람처럼 순차 입력하는 기능을 가집니다. 로직은 공유하지 않고 각자 사본을 두지만 **동작은 동일하게 맞춰 둡니다**(로그인 셀렉터, 단어 단위 타이핑, 재작성, 문장마다 줄바꿈 등). 한쪽을 고치면 다른 쪽도 맞춰야 합니다.

- B: `automation/lib/naver/post-writer.ts` (웹 UI `/write-post`에서 트리거, 서버가 브라우저 관리)
- C: `typing-app/lib/naver-typer.cjs` (독립 exe, 크롬을 detached로 띄워 **프로그램을 꺼도 크롬 유지**)

⚠️ 네이버 로그인 버튼은 2026-07 기준 `#loginBtn_row`/`#loginBtn_column`(반응형)입니다. "패스키 로그인"(`#passkeyBtn_*`)과 class가 같아 `has-text("로그인")`는 엉뚱한 버튼을 눌러 실패합니다. **셀렉터가 깨지면 `node typing-app/inspect-login.cjs` 방식으로 실제 DOM을 조사해 고치세요.**

### B를 Vercel에 올릴 수 없는 이유

과거에 검토된 사항이며, 다시 시도하기 전에 읽어주세요.

1. **실행 시간** — 댓글 자동화는 글 사이에 3~5분 대기합니다(`baseWaitMs`, 최소 180초). 10개 처리 시 30~50분으로, Vercel Function 상한(Hobby 300초 / Pro 800초)을 크게 초과합니다.
2. **브라우저 모드** — 모든 자동화가 `headless: false`로 실제 크롬 창을 띄웁니다. 서버리스에는 디스플레이가 없습니다.
3. **로그인 위치** — 네이버는 평소와 다른 IP에서 로그인하면 2차 인증을 요구합니다. 현재 코드는 사람이 직접 2차 인증을 처리하도록 최대 2분 대기합니다. Vercel Sandbox는 `iad1`(미국) 단일 리전이라 통과할 수 없고, 계정 제재 위험도 있습니다.

대안이 필요하면 로컬 스케줄러 또는 한국 리전 VPS를 검토하세요.

---

## 실행

```bash
# A (글 생성) - 포트 3000
npm install
npm run dev

# B (네이버 자동화 + 순차 입력) - 포트 80
cd automation
npm install
cp .env.local.example .env.local  # 값 채우기 (A와 동일한 Supabase 값)
npm run dev                        # 브라우저에서 http://localhost 접속

# C (순차입력기 exe) - 빌드
cd typing-app
npm install
npm run build                      # dist-single/네이버블로그순차입력기.exe (단일 파일)
# 실행: 그 exe를 더블클릭 (시스템 크롬 필요)
```

A와 B는 포트가 달라(3000 / 80) 동시에 띄울 수 있습니다. C는 독립 exe라 별개입니다.

⚠️ B의 hosts 도메인은 `jsy.auto.blog.com`입니다(`setup-hosts.bat`, 관리자 권한 필요, 백신이 hosts 수정을 막을 수 있음). 도메인 없이 `http://localhost`로도 접속됩니다.

### 품질 검증

```bash
npm run check-all   # typecheck + build (권장)
npm run typecheck   # tsc --noEmit
npm run build       # 프로덕션 빌드
```

`npm run lint`는 **ESLint 설정 파일이 없어 대화형 초기화 프롬프트가 뜹니다.** 실질적인 검증 게이트는 `npm run check-all`입니다.

---

## A: 블로그 글 생성

### 인증

- `middleware.ts` — `jose`로 `blog_session` 쿠키의 JWT 검증
- 공개: `/login`, `/api/auth/login`
- 보호: `/generate`, `/format`, `/api/generate`, `/api/blog`, `/api/products`
- 페이지는 `/login` 리다이렉트, API는 401 반환
- 세션 24시간, 비밀번호는 `AUTH_PASSWORD` 환경변수와 비교 (`lib/utils/validation.ts`)
- ⚠️ `/api/place`, `/api/search`는 `protectedPaths`에 없어 **인증 없이 호출 가능**합니다. 둘 다 외부 API 비용이 발생하므로 공개 배포 시 추가를 검토하세요.

### 전문가 시스템

기본 모드는 제거됐고 **전문가 모드만** 존재합니다. 전문가 4종(`lib/experts/definitions.ts`):

| 전문가 | 아이콘 | 추천 타입 |
|---|---|---|
| 맛집 파워 블로거 | 🍽️ | `nearby` |
| 제품 후기 파워 블로거 | 📦 | `related` |
| 여행 파워 블로거 | ✈️ | `destination` |
| 리빙 파워 블로거 | 🏠 | `related` |

각 전문가는 페르소나·전문어휘와 함께 **이미지 분석용 / 콘텐츠 생성용 프롬프트 쌍**을 `lib/experts/prompts.ts`에 가집니다.

### 데이터 흐름

```
/format (전문가별 문체 학습 - 탭 4개, 각 예시글 2~5개)
  → POST /api/blog/analyze-style  { expertType, posts[] }
      detectSentenceEnding()으로 종결어미를 코드로 판정
      → analyzeStyleCompact(posts, scope)로 문체 가이드 생성
      → 메모리 캐시(expert별) + Supabase blog_styles(expert_id) + Assistant instruction

/generate (ExpertModeTab 단일 진입점)
  → 클라이언트 압축 (canvas, 최대 1280px, JPEG 75%)
  → POST /api/generate/analyze-images-expert   (5장씩 배치, detail: "high")
  → POST /api/generate/create-content-expert   (웹검색·추천·가게정보 통합)
      선택한 전문가의 문체를 조회해 generateBlogContentExpert(styleGuide)로 전달
  → 결과 표시 → POST /api/generate/refine-content (대화형 부분 수정)
  → TXT 다운로드 / 클립보드 복사
```

보조 데이터 소스:

| 엔드포인트 | 내용 |
|---|---|
| `/api/place/search` | Google Places — 주소·영업시간·리뷰·메뉴 |
| `/api/products/search` | 네이버 쇼핑 API (rate limit 10회/분) |
| `/api/search/web` | 네이버/구글 검색 + `fact-extractor`(temperature 0.1, 할루시네이션 방지) |
| `/api/search/recommendations` | 전문가별 추천 |

### 스타일 저장소 (Supabase 기반, 전문가별)

`lib/utils/style-storage.ts`가 Supabase `blog_styles` 테이블을 읽고 씁니다. 접근은 `supabaseServer`(secret 키)로만 하며, `user_id`는 `"default"` 고정입니다.

**문체는 전문가마다 따로 저장됩니다.** 저장 단위는 `(user_id, expert_id)` 복합 UNIQUE이고, `expert_id`는 `restaurant | product | travel | living | common` 중 하나입니다. `common`은 전문가를 지정하지 않고 분석한 문체로, 해당 전문가 문체가 없을 때의 폴백입니다.

조회 우선순위: **메모리 캐시(해당 전문가) → 메모리 캐시(common) → Supabase(해당 전문가) → Supabase(common) → null**

`null`이면 글 생성은 실패하지 않고 전문가 페르소나의 기본 톤으로 진행됩니다.

- 저장(`saveBlogStyleToSupabase`)은 `user_id`로 조회해 **있으면 UPDATE, 없으면 INSERT**합니다
- Supabase 저장이 실패해도 메모리 캐시에는 남아 그 프로세스가 살아있는 동안은 동작합니다. `analyze-style` 응답의 `persisted` 필드로 실제 영구 저장 여부를 구분합니다
- 조회 시 레코드가 없으면 `PGRST116`이 오는데, 이건 오류가 아니라 정상 상태로 처리합니다

⚠️ 과거에 `data/blog-style.txt` 파일 기반으로 전환했다가 되돌렸습니다(`f1cd749` → `cf1fa89`). **`data/` 디렉터리와 `next.config.ts`의 `outputFileTracingIncludes`는 현재 존재하지 않습니다.** 다시 파일 기반으로 바꾸려 하기 전에 Vercel 함수 파일시스템이 읽기 전용이라는 점을 고려하세요.

### 종결어미 일관성 (최우선 규칙)

종결어미는 **LLM 판단이 아니라 코드가 직접 셉니다.** `detectSentenceEnding()`(`lib/openai/blog-analyzer.ts`)이 예시글의 문장 경계 직전 어미를 정규식으로 세어 `요`/`다` 우세를 판정하고, 그 결과를 분석 프롬프트에 확정값으로 박아 넣습니다. 생성 시에는 `resolveEndingRule()`(`lib/openai/content-generator.ts`)이 저장된 가이드의 `uses ~~다 endings` 문구를 읽어 PRIORITY 1 지시문을 만듭니다.

⚠️ 과거에는 분석 프롬프트에 "ALWAYS FORCE ~~요"라는 강제 변환 규칙이 있어 `~~다`체 블로그의 문체가 무시됐습니다. 되돌리지 마세요. 페르소나(`lib/experts/prompts.ts`)도 더 이상 `~~요`를 하드코딩하지 않고 user 메시지의 지시를 따릅니다.

⚠️ **예외 — 글쓰기 가이드의 종결어미 지배(2026-07-24 사용자 결정).** `writing_guides.ending_pattern`에 값(`요`/`다`)이 있으면 `resolveEndingRule()`이 그 값을 **학습 문체보다 우선**해서 PRIORITY 1을 만듭니다. 즉 참고 자료(케넨)의 문체가 학습된 전문가 문체의 어미까지 덮어씁니다. 이는 "학습 문체 우선" 원칙을 의도적으로 뒤집은 것이며, `ending_pattern`이 NULL이면 기존처럼 학습 문체를 따릅니다. 되돌리기 전에 반드시 사용자에게 확인하세요.

프롬프트 우선순위를 수정할 때 이 순서를 깨지 마세요.

1. 종결어미 일관성
2. 이미지 기반 묘사 (보이는 것만)
3. 자연스러운 톤
4. 기술 요구사항 (마커·키워드)
5. 품질·가독성

### 마커 시스템

- 형식: `[IMAGE_1]` ~ `[IMAGE_N]` (1부터 시작)
- 프롬프트로 정확히 N개를 강제하고, 실패 시 `insertMissingMarkers` / `removeExcessMarkers`로 보정 후 최종 검증합니다 (`lib/openai/content-generator.ts`)
- 개수가 끝내 맞지 않으면 예외를 던집니다

---

## B: 네이버 블로그 자동화

`automation/` 하위의 독립 Next.js 프로젝트입니다. 자세한 내용은 `automation/README.md` 참고.

| 화면 | 기능 |
|---|---|
| `/` | 이웃새글 홈 일괄 좋아요 |
| `/comment-and-like` | 이웃 글에 댓글 + 좋아요 |
| `/add-buddy` | 서로이웃 자동 신청 |
| `/write-post` | 완성된 글을 사람처럼 순차 입력 |

- 자동화 본체: `automation/lib/naver/blog-automation.ts` (약 2,280줄, Playwright)
- 순차 입력: `automation/lib/naver/post-writer.ts` — 스마트에디터 ONE에 한 글자씩 입력.
  **기본값은 발행하지 않고** 에디터를 열어 둔 채 멈춥니다(`autoPublish: true`여야 발행).
  발행하지 않으면 브라우저도 닫지 않습니다. 셀렉터는 파일 상단 상수에 다중 폴백으로 모아
  두었고, 네이버가 DOM을 바꾸면 여기부터 확인하면 됩니다
- 댓글 생성: `automation/lib/openai/comment-generator.ts` — 메모리 캐시 → Supabase `blog_styles` 순으로 문체를 읽어 참조, 2~3문장 / 80~150자 / `~~요` 종결
- ⚠️ A가 전문가별로 여러 행을 쓰므로 B의 조회는 `.single()`을 쓰면 안 됩니다. 최신순으로 받아 `common` → 최신 순으로 하나를 고릅니다 (`automation/lib/utils/style-storage.ts`)
- Supabase 사용처는 두 곳: 문체 조회(`blog_styles`, 읽기 전용)와 서로이웃 대상 목록(`neighbor_target_list`). 스키마는 저장소 루트 `supabase/migrations/`에 있습니다(B 하위가 아님)
- 모든 API가 `NODE_ENV === 'development' && !VERCEL`일 때만 동작하고, 그 외에는 403 반환
- ⚠️ B의 API는 인증이 없습니다. 로컬 전용 전제이므로 외부에 노출하지 마세요.

### 스팸 방지 대기 시간

줄이면 네이버 봇 탐지 위험이 커집니다.

| 항목 | 위치 | 값 |
|---|---|---|
| 댓글 간격 | `lib/naver/blog-automation.ts` `baseWaitMs` | 최소 3분 + 0~2분 랜덤 |
| 서로이웃 간격 | `app/api/neighbor/add-buddy/route.ts` `waitSec` | 10~60초 랜덤 |

---

## 환경변수

`.env.local`은 A와 B가 각각 따로 가집니다. 코드가 실제로 참조하는 값만 적었습니다.

### A (저장소 루트 `.env.local`)

```bash
OPENAI_API_KEY=sk-proj-...
OPENAI_ASSISTANT_ID=asst_...      # 선택 - 없으면 Assistant 동기화 생략
AUTH_PASSWORD=<로그인 비밀번호>    # 미설정 시 로그인이 무조건 거부됩니다
SESSION_SECRET=<32자 이상 랜덤>

# 스타일 저장소 (필수) - B와 반드시 동일한 값을 써야 합니다
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...

# 선택 (기능별)
GOOGLE_PLACES_API_KEY=...         # 가게 정보 조회
NAVER_CLIENT_ID=...               # 웹 검색 / 쇼핑 검색
NAVER_CLIENT_SECRET=...
GOOGLE_CSE_ID=...                 # 구글 웹 검색
GOOGLE_CSE_API_KEY=...
```

### B (`automation/.env.local`)

```bash
OPENAI_API_KEY=sk-proj-...        # 댓글 생성
NEXT_PUBLIC_SUPABASE_URL=...      # 문체 조회 + 서로이웃 대상 목록 (A와 동일한 값)
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NAVER_TEST_ID=                    # scripts/ 디버깅 스크립트 전용
NAVER_TEST_PW=
```

**자격증명을 소스코드에 하드코딩하지 마세요.** 반드시 환경변수 또는 화면 입력을 사용합니다.

### Supabase 키 체계

현재 프로젝트는 **신형 키**(`sb_publishable_` / `sb_secret_`)를 씁니다. 레거시 JWT 키(`anon` / `service_role`, `eyJ...`)도 대시보드에 남아 있지만 사용하지 않습니다. 환경변수 **이름**은 과거 그대로 두었으므로(`..._ANON_KEY`에 publishable, `..._SERVICE_ROLE_KEY`에 secret) 이름만 보고 레거시 키로 되돌리지 마세요.

연결이 의심되면 다음으로 확인합니다. 두 프로젝트의 URL·키를 실제 REST 호출로 검증합니다.

```bash
node automation/scripts/verify-supabase.mjs
```

---

## 파일 구조

```
├── app/
│   ├── (auth)/login/
│   ├── (protected)/
│   │   ├── layout.tsx          # 인증 래퍼
│   │   ├── generate/page.tsx   # 글 생성 (ExpertModeTab 진입점)
│   │   └── format/page.tsx     # 스타일 분석
│   └── api/
│       ├── auth/{login,verify}/
│       ├── blog/{analyze-style,get-current-style}/
│       ├── generate/{analyze-images-expert,create-content-expert,refine-content}/
│       ├── place/search/       # Google Places
│       ├── products/search/    # 네이버 쇼핑
│       └── search/{web,recommendations}/
├── components/
│   ├── expert/                 # 전문가 모드 UI (ExpertModeTab이 통합)
│   ├── form/{ImageUpload,KeywordInput}.tsx
│   └── layout/Navigation.tsx
├── lib/
│   ├── auth/session.ts
│   ├── experts/{definitions,prompts}.ts
│   ├── openai/{client,assistant,blog-analyzer,image-analyzer,content-generator,prompts}.ts
│   ├── place/google-places.ts
│   ├── search/{web-search,fact-extractor,recommendations,product-search}.ts
│   ├── supabase/client.ts       # supabaseClient(publishable) / supabaseServer(secret)
│   └── utils/{style-storage,blog-style-memory-cache,marker-parser,client-image-guide,download,validation,rate-limiter}.ts
├── types/index.ts
├── supabase/migrations/        # blog_styles, neighbor_target_list 스키마 (A·B 공용)
├── middleware.ts
└── automation/                 # B (독립 프로젝트)
```

---

## 자주 하는 작업

| 작업 | 파일 |
|---|---|
| 보호 경로 추가 | `middleware.ts` `protectedPaths` |
| 전문가 추가/수정 | `lib/experts/definitions.ts` + `lib/experts/prompts.ts` (+ `blog_styles.expert_id` 값이 늘어남) |
| 문체 예시글 개수 조정 | `lib/openai/blog-analyzer.ts` `MIN_STYLE_SAMPLES`/`MAX_STYLE_SAMPLES` + `format/page.tsx` |
| 종결어미 판정 로직 | `lib/openai/blog-analyzer.ts` `detectSentenceEnding()` |
| 생성 프롬프트 우선순위 수정 | `lib/openai/content-generator.ts` (4단계 순서 유지) |
| 이미지 분석 품질/비용 조정 | `lib/openai/image-analyzer.ts` `detail: "high"`, 배치 크기 5 |
| 클라이언트 이미지 압축 조정 | `app/(protected)/generate/page.tsx` `compressImage` (1280px / 0.75) |
| 스타일 캐시 TTL | `lib/utils/blog-style-memory-cache.ts` `CACHE_DURATION` (24시간) — A·B 각각 있음 |
| 스타일 저장/조회 로직 | `lib/utils/style-storage.ts` (A는 읽기·쓰기, `automation/`쪽은 읽기 전용) |
| Supabase 스키마 변경 | `supabase/migrations/` 에 SQL 추가 후 대시보드 SQL Editor에서 실행 |
| Rate limit 조정 | `lib/utils/rate-limiter.ts` (기본 10회/분, IP 500개 추적) |
| 다운로드 형식 추가 | `lib/utils/download.ts` + `generate/page.tsx` `handleDownload` |
| 댓글 길이/톤 | `automation/lib/openai/comment-generator.ts` |
| 네이버 DOM 셀렉터 | `automation/lib/naver/blog-automation.ts` (iframe은 `contentDocument` 사용) |
| 순차 입력 속도·셀렉터 | `automation/lib/naver/post-writer.ts` (상단 상수 + `charDelayMs`) |

---

## 알려진 이슈

수정 전에 확인하세요. 모두 현재 코드에 남아 있습니다.

| 위치 | 내용 |
|---|---|
| `lib/utils/download.ts` `generateHtml` | 마커를 `<div>` 플레이스홀더로 치환한 뒤 `escapeHtml`을 적용해, HTML 내보내기 시 태그가 **글자 그대로** 출력됩니다. 현재 UI는 TXT만 연결돼 있어 드러나지 않습니다. |
| `lib/utils/download.ts` | `generatePlainText()`(마커 제거 버전)가 어디서도 호출되지 않습니다. `triggerDownload`는 항상 마커를 포함합니다. |
| ESLint | 설정 파일이 없어 `npm run lint`가 실행되지 않습니다. 실질적인 검증 게이트는 `npm run check-all`입니다. |
| `automation/scripts/*.bat` | **CP949(ANSI) + CRLF 두 조건을 모두 만족해야 합니다.** ① UTF-8이면 한글이 깨지고 명령이 망가집니다(2번째 줄의 `chcp 65001`은 이미 늦어 소용없음). ② LF 단독이면 인코딩이 맞아도 **명령이 줄 중간에서 잘립니다**(`'STS" >nul 2>&1' is not recognized` 같은 증상). 편집 도구는 UTF-8+LF로 저장하므로 수정 후 반드시 재변환하세요. 이모지 금지. `.gitattributes`에 `*.bat -text` 등록됨. |

### 해결된 이슈

- `lib/openai/client.ts`의 가짜 모델명(`gpt-5.2`, `claude-opus-4-6`, `gemini-3-pro` 등)은 `7424835`에서 제거됐습니다. 현재 실재 모델은 `gpt-5.6-sol` / `gpt-5.6-terra` / `gpt-5.6-luna` / `gpt-4o` 계열입니다. **모델을 추가할 때는 반드시 `GET /v1/models`로 실재 여부를 먼저 확인하세요.** GPT-5 계열은 `max_tokens`/`temperature`를 거부하며 `buildChatParams()`가 이를 흡수합니다.
- **기본 모델은 `gpt-5.6-terra`입니다**(2026-07-24 비용 절감). 이미지 분석·본문 생성 모두 terra. 공식 단가(1M 토큰): sol $5/$30, terra $2.5/$15, luna $1/$6 — **terra는 sol의 정확히 절반**. 글 1편(이미지 5~9장) 약 140원. UI 모델 선택에서 sol(최고품질)로 개별 지정 가능.

---

## 배포 (A만)

- `.vercelignore`가 `automation/`, `tests/`, `test-results/`, `.playwright-mcp/`를 제외합니다. B는 절대 배포되지 않습니다.
- **Vercel 환경변수에 Supabase 3종(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)을 반드시 등록해야 합니다.** 스타일 저장소가 Supabase이므로 빠지면 `/format` 결과가 영구 저장되지 않고 `/generate`가 문체를 읽지 못합니다.
- 스타일은 배포 후 `/format`을 한 번 실행하면 Supabase에 저장되어 즉시 반영됩니다. 커밋할 파일은 없습니다.
- `npm run check-all` 통과를 배포 전 기준으로 삼으세요.

## 보안

- `.env.local`은 커밋하지 않습니다 (`.gitignore` 등록됨).
- JWT는 HTTP-only 쿠키에 저장되어 클라이언트 JS가 접근할 수 없습니다.
- `SESSION_SECRET`은 32자 이상 랜덤 값을 쓰고, `middleware.ts`의 하드코딩된 기본값에 의존하지 마세요.
- `validatePassword()`는 `AUTH_PASSWORD` 미설정 시 폴백 없이 **무조건 거부**합니다. 이 동작을 되돌리지 마세요.
- `automation/scripts/investigate-popup*`는 `.gitignore` 대상입니다. 자격증명이 섞이기 쉬운 임시 스크립트입니다.
- `SUPABASE_SERVICE_ROLE_KEY`(secret 키)는 **RLS를 우회**합니다. 서버 코드(`supabaseServer`)에서만 쓰고, `NEXT_PUBLIC_` 접두사를 붙이거나 클라이언트 번들로 내보내지 마세요.
- 현재 두 테이블의 RLS 정책은 모두 `USING (TRUE)`라 **키만 있으면 누구나 읽고 씁니다.** 단일 사용자 전제라 이렇게 둔 것이며, 다중 사용자로 확장한다면 `user_id` 기준 정책으로 반드시 다시 짜야 합니다.
