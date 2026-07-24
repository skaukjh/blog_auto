# AI Blog Post Generator

내 블로그 문체를 학습해서, 업로드한 사진에 맞는 블로그 글을 대신 써주는 웹 애플리케이션입니다.

이 저장소에는 **독립적인 두 개의 프로젝트**가 들어 있습니다.

| | 위치 | 역할 | 실행 |
|---|---|---|---|
| **A** | 저장소 루트 | AI 블로그 글 생성 | Vercel 배포 / 로컬 3000 |
| **B** | `automation/` | 네이버 블로그 이웃 자동화 | **로컬 전용** 3001 |

두 프로젝트는 Supabase의 `blog_styles` 테이블 하나만 공유합니다. A가 분석해서 쓰고, B가 댓글 문체를 맞출 때 읽습니다. 코드는 공유하지 않습니다.

---

## A: 블로그 글 생성

### 무엇을 하나

1. **문체 학습** — 내 블로그 글 2개를 붙여넣으면 문체를 분석합니다. 종결어미(`~~요` / `~~다`), 톤, 자주 쓰는 표현을 뽑아 Supabase `blog_styles` 테이블에 저장합니다.
2. **전문가 선택** — 맛집 🍽️ / 제품 📦 / 여행 ✈️ / 리빙 🏠 중에서 고릅니다. 각 전문가는 전용 어휘와 관점을 가집니다.
3. **사진 분석** — 최대 25장을 5장씩 묶어 고품질(`detail: "high"`)로 분석합니다. 색감, 질감, 구도, 조명까지 읽습니다.
4. **글 생성** — 주제·키워드·길이를 입력하면 학습한 문체 그대로 글을 씁니다. 사진이 들어갈 자리에 `[IMAGE_1]` 같은 마커가 자동으로 박힙니다.
5. **다듬기** — "두 번째 문단을 더 자세히" 같이 대화로 부분 수정할 수 있습니다.
6. **내보내기** — 클립보드 복사 또는 TXT 다운로드.

선택 기능으로 가게 정보(Google Places), 제품 검색(네이버 쇼핑), 웹 검색(네이버·구글)을 글에 섞을 수 있습니다.

### 시작하기

```bash
npm install
cp .env.local.example .env.local   # 없다면 아래 항목을 직접 작성
npm run dev                        # http://localhost:3000
```

`.env.local`:

```bash
OPENAI_API_KEY=sk-proj-...
AUTH_PASSWORD=<로그인 비밀번호>
SESSION_SECRET=<32자 이상 랜덤 문자열>

# 문체 저장소 - B와 반드시 같은 프로젝트를 가리켜야 합니다
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...

# 선택 - 없으면 해당 기능만 비활성화됩니다
OPENAI_ASSISTANT_ID=asst_...      # 문체를 Assistant instruction에 동기화
GOOGLE_PLACES_API_KEY=...         # 가게 정보
NAVER_CLIENT_ID=...               # 웹 검색 / 쇼핑 검색
NAVER_CLIENT_SECRET=...
GOOGLE_CSE_ID=...                 # 구글 웹 검색
GOOGLE_CSE_API_KEY=...
```

`AUTH_PASSWORD`가 없으면 로그인이 항상 거부됩니다.

### 사용 순서

1. `/login` — 비밀번호 입력
2. `/format` — 내 블로그 글 2개 이상(각 300자 이상) 붙여넣고 문체 분석
3. `/generate` — 전문가 선택 → 사진 업로드 → 주제·키워드·길이 입력 → 생성

문체 분석을 먼저 하지 않으면 생성 버튼이 비활성화됩니다.

### 검증

```bash
npm run check-all   # 타입체크 + 프로덕션 빌드
```

> `npm run lint`는 ESLint 설정 파일이 없어 동작하지 않습니다. `check-all`을 기준으로 삼으세요.

---

## B: 네이버 블로그 자동화

Playwright로 이웃 글에 좋아요·댓글을 남기고 서로이웃을 신청합니다. **로컬에서만 동작**하며, 모든 API가 개발 환경이 아니면 403을 반환합니다.

```bash
cd automation
npm install
npx playwright install chromium
cp .env.local.example .env.local
npm run dev                        # http://localhost:3001
```

자세한 내용은 [`automation/README.md`](automation/README.md)를 참고하세요.

### Vercel에 올릴 수 없는 이유

- 댓글 자동화는 글 사이에 3~5분 대기해 실행이 30~50분에 이릅니다. Vercel Function 상한(최대 800초)을 넘습니다.
- 실제 크롬 창(`headless: false`)이 필요한데 서버리스에는 디스플레이가 없습니다.
- 네이버가 낯선 IP 로그인에 2차 인증을 요구하고, 현재 코드는 사람이 직접 처리하도록 기다립니다. 계정 제재 위험도 있습니다.

---

## 기술 스택

- **프레임워크** — Next.js 15 (App Router), React 19, TypeScript strict
- **스타일** — Tailwind CSS 3
- **AI** — OpenAI API (`gpt-5.6-sol` 본문·이미지, `gpt-5.6-terra` 보조)
- **인증** — JWT (`jose`), HTTP-only 쿠키, 24시간 세션
- **문서 생성** — `docx`
- **자동화(B)** — Playwright
- **저장소** — Supabase (`blog_styles` 문체 / `neighbor_target_list` B의 대상 목록)

## 구조

```
├── app/                  # A: 페이지 + API 라우트
├── components/           # A: UI (expert / form / layout)
├── lib/                  # A: openai, experts, search, place, supabase, utils
├── types/index.ts
├── supabase/migrations/  # 테이블 스키마 (A·B 공용)
├── middleware.ts         # JWT 경로 보호
└── automation/           # B: 독립 프로젝트
```

## 배포 (A만)

`.vercelignore`가 `automation/`을 제외하므로 B는 배포되지 않습니다.

Vercel 환경변수에 **Supabase 3종을 반드시 등록**하세요. 문체 저장소가 Supabase이므로 빠지면 `/format` 결과가 저장되지 않고 `/generate`가 문체를 읽지 못합니다. 등록 후에는 배포된 앱에서 `/format`을 한 번 실행하면 바로 반영되며, 따로 커밋할 파일은 없습니다.

## 보안

- `.env.local`은 커밋하지 않습니다.
- JWT는 HTTP-only 쿠키에 저장되어 클라이언트 JS가 접근할 수 없습니다.
- 자격증명을 소스코드에 하드코딩하지 마세요. 환경변수 또는 화면 입력만 사용합니다.
- B의 API에는 인증이 없습니다. 로컬 전용 전제이므로 외부에 노출하지 마세요.

---

**마지막 업데이트**: 2026-07-24
