# 네이버 블로그 자동화 (B)

Playwright로 네이버 블로그 이웃 활동을 자동화하는 **로컬 전용** 프로젝트입니다.
글 생성 앱(A, 저장소 루트)과 완전히 분리되어 있으며 별도의 `package.json` / `node_modules` 를 가집니다.

## 왜 분리되어 있나

A는 Vercel에 배포하고 B는 로컬에서만 돌리기 때문입니다. B는 다음 이유로 서버리스 환경에 올릴 수 없습니다.

- **실행 시간**: 댓글 자동화는 글 사이에 3~5분씩 대기합니다. 10개 처리 시 30~50분으로 Vercel Function 상한(최대 800초)을 크게 초과합니다.
- **브라우저 모드**: `headless: false` 로 실제 크롬 창을 띄웁니다. 서버리스에는 디스플레이가 없습니다.
- **로그인 위치**: 네이버는 평소와 다른 IP에서 로그인하면 2차 인증을 요구합니다. 현재 코드는 사람이 직접 2차 인증을 처리하도록 최대 2분 대기합니다. 해외 데이터센터 IP에서는 통과할 수 없고, 계정 제재 위험도 있습니다.

## 설치

```bash
cd automation
npm install
npx playwright install chromium   # 최초 1회
cp .env.local.example .env.local  # 값 채우기
```

## 실행

```bash
npm run dev     # http://localhost:3001
```

A(루트)는 3000번, B는 3001번 포트를 쓰므로 동시에 띄울 수 있습니다.

## 화면

| 경로 | 기능 |
|---|---|
| `/` | 이웃새글 홈 일괄 좋아요 |
| `/comment-and-like` | 이웃 글에 댓글 + 좋아요 |
| `/add-buddy` | 서로이웃 자동 신청 |

## API

모든 엔드포인트는 `process.env.NODE_ENV === 'development' && !process.env.VERCEL` 일 때만 동작하며, 그 외에는 403을 반환합니다.

| 엔드포인트 | 기능 |
|---|---|
| `POST /api/neighbor/like-home` | 이웃새글 홈 일괄 좋아요 |
| `POST /api/neighbor/comment-and-like` | 댓글 + 좋아요 |
| `POST /api/neighbor/add-buddy` | 서로이웃 신청 |
| `POST /api/neighbor/sync-buddy-list` | 서로이웃 목록을 Supabase에 동기화 |
| `GET/POST/DELETE /api/neighbor/target-list` | 대상 닉네임 목록 관리 |
| `POST /api/neighbor/process` | 이웃 자동 좋아요 (레거시) |

## A와의 연결점

B는 A가 분석해 둔 **블로그 문체(종결어미 등)를 읽어** 댓글을 생성합니다.

```
A: /format 분석  →  <저장소 루트>/data/blog-style.txt  →  B: 댓글 생성 시 참조
```

- 읽는 코드: `lib/openai/comment-generator.ts` → `lib/utils/style-storage.ts` (읽기 전용)
- B는 `automation/` 에서 실행되므로 `../data/blog-style.txt` 를 먼저 찾습니다.
- 파일이 없으면 댓글은 기본 프롬프트만으로 생성됩니다. A의 `/format` 에서 먼저 분석하세요.

파일 하나만 공유할 뿐 A ↔ B 사이의 코드 의존성은 없습니다.

Supabase는 B의 **서로이웃 대상 목록**(`neighbor_target_list` 테이블)에만 쓰입니다.
스키마는 `supabase/migrations/` 에 있습니다.

## 구조

```
automation/
├── app/
│   ├── page.tsx                    # 홈 일괄 좋아요
│   ├── comment-and-like/page.tsx
│   ├── add-buddy/page.tsx
│   └── api/neighbor/**/route.ts
├── lib/
│   ├── naver/blog-automation.ts    # Playwright 자동화 본체
│   ├── openai/comment-generator.ts # 댓글 생성
│   ├── utils/neighbor-target-list.ts   # 대상 목록 (Supabase)
│   ├── utils/style-storage.ts          # ../data/blog-style.txt 읽기 (읽기 전용)
│   └── supabase/client.ts
├── supabase/migrations/                # neighbor_target_list 스키마
└── scripts/
    ├── test-neighbor.ts            # npm run test:neighbor
    └── investigate-popup*.cjs      # 서로이웃 팝업 DOM 조사용 (git 제외)
```

## 주의

- 자격증명을 소스코드에 하드코딩하지 마세요. 반드시 `.env.local` 또는 화면 입력을 사용하세요.
- 대기 시간(스팸 방지)을 줄이면 네이버 봇 탐지에 걸릴 위험이 커집니다.
  - 댓글 간격: `lib/naver/blog-automation.ts` 의 `baseWaitMs` (최소 3분)
  - 서로이웃 간격: `app/api/neighbor/add-buddy/route.ts` 의 `waitSec` (10~60초)
