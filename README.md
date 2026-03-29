# AI Blog Post Generator

파워 블로거 스타일의 AI 기반 블로그 글 자동 생성 웹 애플리케이션입니다.

## 기능

### 1. 블로그 스타일 학습 (포맷 관리)
- 대상 블로그의 최신 글 2개를 자동 크롤링
- GPT-4o를 사용한 블로그 스타일 분석
- 톤, 구조, 이모티콘, 자주 사용하는 표현 등 추출
- 24시간 캐시 시스템으로 토큰 비용 최적화

### 2. 이미지 분석
- 최대 25장의 이미지 배치 분석 (5-6장 단위)
- GPT-4o-mini의 저상세 이미지 분석 (`detail: "low"`)
- 각 이미지의 카테고리, 분위기, 설명 추출
- 통합 컨텍스트 분석 (모든 이미지가 어떻게 함께 작동하는지)

### 3. AI 글 생성
- 주제, 글 길이(짧음/중간/길음), 이미지, 키워드 기반 생성
- 이미지 삽입 위치 자동 결정 (`[IMAGE_N]` 마커)
- 학습된 블로그 스타일 자동 적용
- 키워드 자연스럽게 삽입

### 4. 결과 관리
- 생성된 글 복사 (마커 포함/제외)
- 다운로드 (TXT, DOCX, HTML)
- 이미지 가이드 (위치, 문맥, 추천 캡션)

## 기술 스택

- **Frontend**: React 19, Next.js 15 (App Router), TailwindCSS 4
- **Backend**: Next.js API Routes
- **AI/ML**: OpenAI API (GPT-4o, GPT-4o-mini)
- **Image Processing**: Sharp
- **Web Scraping**: Cheerio
- **Authentication**: JWT (jose)
- **Document Generation**: docx
- **UI Components**: Radix UI, Custom Components
- **Drag & Drop**: @dnd-kit

## 시작하기

### 설치

```bash
# Dependencies 설치
npm install

# 개발 서버 시작
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 실행
npm start
```

### 환경 설정

`.env.local` 파일을 생성하고 다음을 설정합니다:

```
OPENAI_API_KEY=sk-proj-...
OPENAI_ASSISTANT_ID=asst_...  # 프로그램이 자동 생성
AUTH_PASSWORD=wogns0513@
SESSION_SECRET=<32자의 무작위 문자열>
BLOG_URL=https://blog.naver.com/ssyeonee27
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 사용 방법

1. **로그인** (`/login`)
   - 비밀번호 입력 (기본값: `wogns0513@`)

2. **포맷 관리** (`/format`)
   - 블로그 스타일 자동 분석
   - 최근 글 다시 분석 가능

3. **글 생성** (`/generate`)
   - 주제 입력
   - 이미지 업로드 (드래그 앤 드롭)
   - 키워드 추가
   - 글 길이 선택
   - "글 생성하기" 클릭

## API 엔드포인트

### 인증
- `POST /api/auth/login` - 로그인
- `GET /api/auth/verify` - 세션 검증

### 블로그 분석
- `GET /api/blog/fetch-latest` - 최신 글 크롤링
- `POST /api/blog/analyze-style` - 스타일 분석

### 콘텐츠 생성
- `POST /api/generate/analyze-images` - 이미지 분석
- `POST /api/generate/create-content` - 글 생성

### Assistant 관리
- `POST /api/assistant/create` - Assistant 생성

## 주요 기능 설명

### 마커 시스템
생성된 글에는 `[IMAGE_1]`, `[IMAGE_2]` 등의 마커가 자동으로 삽입됩니다.
이는 이미지가 들어갈 위치를 나타냅니다.

### 토큰 비용 최적화
- 모든 System Prompt는 영문
- 이미지 분석 시 `detail: "low"` 사용 (85 tokens/image)
- JSON 압축 형식으로 데이터 전달
- 블로그 스타일 24시간 캐싱

### 캐시 시스템
- `.cache/` 디렉토리에 JSON 형식으로 저장
- 24시간 유효 (설정 변경 가능)
- 캐시 만료 시 자동 재분석

## 프로젝트 구조

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # 공개 라우트 (로그인)
│   ├── (protected)/       # 보호된 라우트 (인증 필요)
│   └── api/               # API 엔드포인트
├── components/            # React 컴포넌트
│   ├── layout/
│   ├── form/
│   └── result/
├── lib/                   # 라이브러리 및 유틸리티
│   ├── auth/             # 인증 (JWT)
│   ├── openai/           # OpenAI 통합
│   ├── blog/             # 블로그 크롤링
│   └── utils/            # 유틸리티 함수
├── types/                # TypeScript 타입 정의
└── middleware.ts         # Next.js 미들웨어

.cache/                   # 블로그 스타일 캐시
```

## 보안

- JWT 기반 세션 인증
- 미들웨어를 통한 경로 보호
- OpenAI API Key는 `.env.local`에 저장 (`.gitignore`에 포함)
- HTTPS 권장 (프로덕션)

## 라이센스

MIT License

## 지원

문제가 발생하거나 기능 요청이 있으시면 이슈를 생성해주세요.

---

**마지막 업데이트**: 2026-02-07
**버전**: 1.0.0
