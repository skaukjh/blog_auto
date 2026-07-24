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
| `/write-post` | 완성된 글을 사람처럼 순차 입력 |

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
| `POST /api/post/write` | 글쓰기 화면에 순차 입력 |

### 글쓰기 순차 입력 (`/write-post`)

완성된 글을 한 번에 붙여넣는 대신 스마트에디터 ONE에 한 글자씩 넣습니다.
문장 끝과 문단 사이에 사람이 생각하는 만큼의 간격을 둡니다.

- **기본값은 발행하지 않습니다.** 타이핑이 끝나면 에디터를 열어 둔 채 멈추고,
  검토와 발행은 사람이 합니다. `autoPublish: true`를 명시해야 발행까지 갑니다
- 발행하지 않은 경우 **브라우저를 닫지 않습니다.** 사람이 확인해야 하기 때문입니다
- `[IMAGE_N]` 마커는 기본적으로 그대로 입력됩니다. 사진 넣을 자리 표시로 쓰고,
  발행 전에 지우세요. `stripImageMarkers: true`면 빼고 입력합니다
- 속도는 글자당 25ms 이상으로 강제됩니다. 더 빠르면 사람처럼 보이지 않습니다
- 본문은 최대 10,000자입니다

⚠️ **스마트에디터 ONE의 DOM 셀렉터는 네이버가 예고 없이 바꿉니다.**
`lib/naver/post-writer.ts` 상단의 셀렉터 상수들은 다중 폴백으로 두었지만,
어느 날 갑자기 "입력 영역을 찾지 못했습니다"가 나오면 그 상수들을 먼저 확인하세요.

브라우저 없이 검증할 수 있는 텍스트 분할 로직은 다음으로 확인합니다.

```bash
npx tsx scripts/test-post-writer.ts
```

## A와의 연결점

B는 A가 분석해 둔 **블로그 문체(종결어미 등)를 읽어** 댓글을 생성합니다.

```
A: /format 분석  →  Supabase blog_styles (user_id="default")  →  B: 댓글 생성 시 참조
```

- 읽는 코드: `lib/openai/comment-generator.ts` → 메모리 캐시(24h) → `lib/utils/style-storage.ts` (읽기 전용)
- **B의 `.env.local` Supabase 값이 A와 동일해야** 문체가 전달됩니다. 다른 프로젝트를 가리키면 조용히 문체 없이 동작합니다.
- 저장된 문체가 없으면 댓글은 기본 프롬프트만으로 생성됩니다. A의 `/format` 에서 먼저 분석하세요.

테이블 하나만 공유할 뿐 A ↔ B 사이의 코드 의존성은 없습니다. `style-storage.ts` 와
`blog-style-memory-cache.ts` 는 양쪽이 각자 사본을 가집니다.

B가 쓰는 Supabase 테이블은 두 개입니다.

| 테이블 | 용도 | 접근 |
|---|---|---|
| `blog_styles` | A가 저장한 문체 조회 | 읽기 전용 |
| `neighbor_target_list` | 서로이웃 대상 닉네임 목록 | 읽기·쓰기 |

스키마는 **저장소 루트**의 `supabase/migrations/` 에 있습니다 (`automation/` 하위가 아님).
연결 확인은 저장소 루트에서 `node automation/scripts/verify-supabase.mjs` 로 합니다.

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
│   ├── utils/style-storage.ts          # blog_styles 조회 (읽기 전용)
│   ├── utils/blog-style-memory-cache.ts # 문체 메모리 캐시 (24시간)
│   └── supabase/client.ts
└── scripts/
    ├── test-neighbor.ts            # npm run test:neighbor
    ├── verify-supabase.mjs         # A·B의 Supabase 연결 검증
    ├── setup-hosts.bat             # hosts 등록 (관리자 권한, CP949 저장 필수)
    ├── install-autostart.bat       # 부팅 자동 실행 등록 (관리자 권한)
    ├── start-automation.bat        # 감시 실행 루프
    └── investigate-popup*.cjs      # 서로이웃 팝업 DOM 조사용 (git 제외)
```

## 주의

- 자격증명을 소스코드에 하드코딩하지 마세요. 반드시 `.env.local` 또는 화면 입력을 사용하세요.
- 대기 시간(스팸 방지)을 줄이면 네이버 봇 탐지에 걸릴 위험이 커집니다.
  - 댓글 간격: `lib/naver/blog-automation.ts` 의 `baseWaitMs` (최소 3분)
  - 서로이웃 간격: `app/api/neighbor/add-buddy/route.ts` 의 `waitSec` (10~60초)
- **`scripts/*.bat` 은 반드시 CP949(ANSI)로 저장하세요.** UTF-8로 저장하면 한국어 Windows의
  cmd.exe가 한글을 깨뜨려 명령까지 망가집니다. 2번째 줄에 `chcp 65001` 을 넣어도 이미 늦어
  소용이 없고, 이모지도 CP949에 없어 쓰면 안 됩니다. 편집 도구는 대개 UTF-8로 저장하므로
  수정 후 아래처럼 되돌리세요. (`.gitattributes` 에 `*.bat -text` 등록돼 있습니다)

  ```powershell
  $p = "scripts\setup-hosts.bat"
  $txt = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)
  [System.IO.File]::WriteAllText($p, $txt, [System.Text.Encoding]::GetEncoding(949))
  ```
