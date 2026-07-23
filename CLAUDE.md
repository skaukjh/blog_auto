# CLAUDE.md

Claude Code(claude.ai/code)가 이 저장소에서 작업할 때 참고하는 문서입니다.

## 저장소 구성

이 저장소에는 **독립적인 두 개의 프로젝트**가 있습니다. 각각 별도의 `package.json`과 `node_modules`를 가지며, 서로 코드를 import하지 않습니다.

| | 위치 | 역할 | 배포 |
|---|---|---|---|
| **A** | 저장소 루트 | AI 블로그 글 생성 | Vercel |
| **B** | `automation/` | 네이버 블로그 이웃 자동화 | **로컬 전용** |

두 프로젝트가 공유하는 것은 `data/blog-style.txt` 파일 하나뿐입니다.

```
A: /format 분석  →  data/blog-style.txt  →  B: 댓글 생성 시 문체 참조
```

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

# B (네이버 자동화) - 포트 3001
cd automation
npm install
npx playwright install chromium   # 최초 1회
cp .env.local.example .env.local  # 값 채우기
npm run dev
```

두 프로젝트는 포트가 달라 동시에 띄울 수 있습니다.

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
/format (스타일 학습)
  → POST /api/blog/analyze-style
      analyzeStyleCompact(gpt-4o)로 종결어미 패턴 추출
      → 메모리 캐시(24h) + data/blog-style.txt + OpenAI Assistant instruction

/generate (ExpertModeTab 단일 진입점)
  → 클라이언트 압축 (canvas, 최대 1280px, JPEG 75%)
  → POST /api/generate/analyze-images-expert   (5장씩 배치, detail: "high")
  → POST /api/generate/create-content-expert   (웹검색·추천·가게정보 통합)
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

### 스타일 저장소 (파일 기반)

`lib/utils/style-storage.ts`가 `data/blog-style.txt`를 읽고 씁니다. 분석 시각은 파일 mtime을 씁니다.

조회 우선순위: **브라우저 sessionStorage → 서버 메모리 캐시(24h) → 파일**

⚠️ **Vercel 제약**: 함수 파일시스템이 읽기 전용이라 배포 환경에서는 쓰기가 실패합니다.
- 스타일을 영구 반영하려면 **로컬에서 분석 → `data/blog-style.txt` 커밋 → 재배포**
- 배포 환경에서 분석해도 결과는 응답으로 돌아와 sessionStorage에 남으므로 그 세션 동안은 정상 동작하며, UI에 주황색 경고가 표시됩니다
- `next.config.ts`의 `outputFileTracingIncludes`로 `data/`가 배포 번들에 포함됩니다. **빌드 시점에 파일이 없으면 번들에도 없습니다.**

### 종결어미 일관성 (최우선 규칙)

스타일 분석이 종결어미 패턴(`~~요` / `~~다` 등)을 추출하고, 생성 프롬프트에서 **PRIORITY 1**로 강제합니다. 프롬프트 우선순위를 수정할 때 이 순서를 깨지 마세요.

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

- 자동화 본체: `automation/lib/naver/blog-automation.ts` (약 2,270줄, Playwright)
- 댓글 생성: `automation/lib/openai/comment-generator.ts` — `data/blog-style.txt` 문체 참조, 2~3문장 / 80~150자 / `~~요` 종결
- 서로이웃 대상 목록만 Supabase(`neighbor_target_list`) 사용. 스키마는 `automation/supabase/migrations/`
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
NEXT_PUBLIC_SUPABASE_URL=...      # 서로이웃 대상 목록
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NAVER_TEST_ID=                    # scripts/ 디버깅 스크립트 전용
NAVER_TEST_PW=
```

**자격증명을 소스코드에 하드코딩하지 마세요.** 반드시 환경변수 또는 화면 입력을 사용합니다.

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
│   └── utils/{style-storage,blog-style-memory-cache,marker-parser,client-image-guide,download,validation,rate-limiter}.ts
├── types/index.ts
├── data/blog-style.txt         # A가 쓰고 B가 읽음 (커밋 대상)
├── middleware.ts
└── automation/                 # B (독립 프로젝트)
```

---

## 자주 하는 작업

| 작업 | 파일 |
|---|---|
| 보호 경로 추가 | `middleware.ts` `protectedPaths` |
| 전문가 추가/수정 | `lib/experts/definitions.ts` + `lib/experts/prompts.ts` |
| 생성 프롬프트 우선순위 수정 | `lib/openai/content-generator.ts` (4단계 순서 유지) |
| 이미지 분석 품질/비용 조정 | `lib/openai/image-analyzer.ts` `detail: "high"`, 배치 크기 5 |
| 클라이언트 이미지 압축 조정 | `app/(protected)/generate/page.tsx` `compressImage` (1280px / 0.75) |
| 스타일 캐시 TTL | `lib/utils/blog-style-memory-cache.ts` `CACHE_DURATION` (24시간) |
| Rate limit 조정 | `lib/utils/rate-limiter.ts` (기본 10회/분, IP 500개 추적) |
| 다운로드 형식 추가 | `lib/utils/download.ts` + `generate/page.tsx` `handleDownload` |
| 댓글 길이/톤 | `automation/lib/openai/comment-generator.ts` |
| 네이버 DOM 셀렉터 | `automation/lib/naver/blog-automation.ts` (iframe은 `contentDocument` 사용) |

---

## 알려진 이슈

수정 전에 확인하세요. 모두 현재 코드에 남아 있습니다.

| 위치 | 내용 |
|---|---|
| `lib/openai/client.ts` | `gpt-5.2`, `gpt-4.5`, `claude-opus-4-6`, `gemini-3-pro` 등 **실존하지 않는 모델명**이 들어 있습니다. Claude/Gemini는 OpenAI SDK로 직접 호출되므로 선택 시 API 오류가 납니다. 안전한 값은 `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`입니다. |
| `lib/utils/download.ts` `generateHtml` | 마커를 `<div>` 플레이스홀더로 치환한 뒤 `escapeHtml`을 적용해, HTML 내보내기 시 태그가 **글자 그대로** 출력됩니다. 현재 UI는 TXT만 연결돼 있어 드러나지 않습니다. |
| `lib/utils/download.ts` | `generatePlainText()`(마커 제거 버전)가 어디서도 호출되지 않습니다. `triggerDownload`는 항상 마커를 포함합니다. |
| ESLint | 설정 파일이 없어 `npm run lint`가 실행되지 않습니다. |

---

## 배포 (A만)

- `.vercelignore`가 `automation/`을 제외합니다. B는 절대 배포되지 않습니다.
- 배포 전 `data/blog-style.txt`가 존재하고 커밋됐는지 확인하세요. 없으면 배포된 앱에 스타일이 없습니다.
- Vercel 환경변수에 A 항목만 등록하면 됩니다. Supabase 키는 A에서 쓰지 않습니다.
- `npm run check-all` 통과를 배포 전 기준으로 삼으세요.

## 보안

- `.env.local`은 커밋하지 않습니다 (`.gitignore` 등록됨).
- JWT는 HTTP-only 쿠키에 저장되어 클라이언트 JS가 접근할 수 없습니다.
- `SESSION_SECRET`은 32자 이상 랜덤 값을 쓰고, `middleware.ts`의 하드코딩된 기본값에 의존하지 마세요.
- `validatePassword()`는 `AUTH_PASSWORD` 미설정 시 폴백 없이 **무조건 거부**합니다. 이 동작을 되돌리지 마세요.
- `automation/scripts/investigate-popup*`는 `.gitignore` 대상입니다. 자격증명이 섞이기 쉬운 임시 스크립트입니다.
