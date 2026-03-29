# Supabase 설정 가이드

## 개요

Supabase를 사용하여 블로그 스타일을 클라우드 데이터베이스에 저장합니다. 이를 통해:
- ✅ Vercel과 같은 서버리스 환경에서 스타일을 영구 보관
- ✅ 파일 시스템에 의존하지 않음
- ✅ 세션 간 스타일 유지
- ✅ 멀티 유저 지원 (future-proof)

## 1단계: Supabase 프로젝트 생성

1. [Supabase 콘솔](https://supabase.com/dashboard)로 이동
2. **새로운 프로젝트 생성** 클릭
3. 다음 정보 입력:
   - **프로젝트 이름**: `blog-ai-generator` (또는 원하는 이름)
   - **데이터베이스 비밀번호**: 안전한 비밀번호 설정
   - **지역**: 가까운 지역 선택 (예: 서울, 도쿄 등)

4. 프로젝트 생성 대기 (약 2-3분)

## 2단계: API 키 복사

1. 프로젝트 대시보드에서 **Settings** → **API** 클릭
2. 다음 키 복사:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role secret** → `SUPABASE_SERVICE_ROLE_KEY`

## 3단계: 환경 변수 설정

`.env.local` 파일 수정:

```bash
# Supabase 설정
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

## 4단계: 데이터베이스 테이블 생성

### 옵션 A: Supabase SQL 에디터 사용 (권장)

1. Supabase 콘솔에서 **SQL Editor** 클릭
2. **New Query** 클릭
3. 다음 SQL 복사 후 실행:

```sql
-- blog_styles 테이블 생성
CREATE TABLE IF NOT EXISTS public.blog_styles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  style_content TEXT NOT NULL,
  analyzed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_blog_styles_user_id ON public.blog_styles(user_id);

-- RLS 활성화
ALTER TABLE public.blog_styles ENABLE ROW LEVEL SECURITY;

-- 정책 생성 (모든 사용자 허용 - 필요시 수정)
CREATE POLICY "Allow all users"
  ON public.blog_styles
  FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_blog_styles_updated_at BEFORE UPDATE ON public.blog_styles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

### 옵션 B: 로컬 마이그레이션 사용

```bash
# Supabase CLI 설치 (필요시)
npm install -g supabase

# 마이그레이션 실행
supabase migration up
```

## 5단계: 테스트

개발 서버 시작:

```bash
npm run dev
```

### 포맷 페이지 테스트 (`/format`)
1. 블로그 글 2개 입력
2. "스타일 분석 시작" 클릭
3. 분석 완료 후:
   - ☁️ **Supabase**: 클라우드에 저장됨
   - 📱 **로컬**: sessionStorage에 저장됨
   - 🤖 **Assistant**: OpenAI Assistant에 반영됨

### 글 생성 페이지 테스트 (`/generate`)
1. 이미지 업로드
2. 주제, 키워드 입력
3. 글 생성 후 "✅ 스타일이 준비되었습니다" 표시 확인

## 6단계: Vercel 배포 (선택사항)

### Vercel 환경 변수 설정

1. [Vercel 프로젝트](https://vercel.com/dashboard) 접속
2. **Settings** → **Environment Variables** 클릭
3. 다음 변수 추가:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

4. **Deployments** → **Redeploy** 클릭

## 데이터 흐름

```
┌─────────────────────────────────────┐
│   Format Page (/format)             │
│   사용자가 글 2개 입력              │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│   API: /api/blog/analyze-style      │
│   - 스타일 분석 (OpenAI)            │
│   - Supabase에 저장                 │
│   - sessionStorage에 저장            │
│   - Assistant 업데이트              │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│   Generate Page (/generate)         │
│   API: /api/blog/get-current-style  │
│   우선순위:                         │
│   1. 메모리 캐시                    │
│   2. Supabase 조회                  │
│   3. 없음                           │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│   글 생성 (저장된 스타일 적용)      │
│   - 이미지 분석                    │
│   - 콘텐츠 생성                    │
│   - 다운로드/복사                  │
└─────────────────────────────────────┘
```

## 트러블슈팅

### 1. "Supabase URL 또는 ANON KEY가 설정되지 않았습니다"
**해결**: `.env.local` 파일에서 환경 변수 확인
```bash
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### 2. Supabase 저장 실패
**확인 사항**:
- 데이터베이스 테이블이 생성되었는지 확인
- RLS 정책이 활성화되어 있는지 확인
- 서비스 역할 키가 유효한지 확인

**로그 확인**:
```bash
# 브라우저 개발자 도구 → Console 탭에서 로그 확인
# "✅ Supabase 스타일 저장 완료" 메시지 확인
```

### 3. 저장된 스타일이 로드되지 않음
**해결**: 다음 순서로 확인
1. sessionStorage에 저장되었는지 확인 (F12 → Application → sessionStorage)
2. Supabase 데이터베이스에 데이터가 있는지 확인
3. API 로그 확인: "📦 메모리 캐시에서 스타일 로드" 또는 "🔍 Supabase에서 스타일 조회 중..."

## 보안 고려사항

### RLS (Row Level Security)
기본 정책은 모든 사용자를 허용합니다. 프로덕션 환경에서는:

```sql
-- 사용자 인증 기반으로 수정 (선택사항)
CREATE POLICY "Users can view their own styles"
  ON public.blog_styles
  FOR SELECT
  USING (auth.uid()::text = user_id);
```

### API 키 노출 방지
- **NEXT_PUBLIC_*** 변수: 클라이언트에 노출됨 (공개 키)
- **SUPABASE_SERVICE_ROLE_KEY**: 서버만 사용 (비밀 키)

## API 엔드포인트

### POST `/api/blog/analyze-style`
블로그 스타일 분석 및 저장

**요청**:
```json
{
  "posts": [
    { "title": "글 제목", "excerpt": "글 내용..." },
    { "title": "글 제목", "excerpt": "글 내용..." }
  ]
}
```

**응답**:
```json
{
  "success": true,
  "compactStyle": "분석된 스타일...",
  "analyzedAt": "2026-02-13T10:30:00Z",
  "cost": { "usd": 0.005, "krw": 6500 },
  "message": "블로그 스타일 분석이 완료되었습니다"
}
```

### GET `/api/blog/get-current-style`
저장된 스타일 조회

**응답 (저장된 스타일 있음)**:
```json
{
  "success": true,
  "style": "분석된 스타일...",
  "exists": true,
  "source": "supabase",
  "analyzedAt": "2026-02-13T10:30:00Z"
}
```

**응답 (저장된 스타일 없음)**:
```json
{
  "success": false,
  "style": null,
  "exists": false,
  "message": "저장된 스타일이 없습니다"
}
```

## 다음 단계

- [ ] 환경 변수 설정 완료
- [ ] 데이터베이스 테이블 생성 완료
- [ ] 로컬 테스트 완료
- [ ] Vercel 배포 (필요시)
- [ ] 프로덕션 RLS 정책 검토

---

**질문이나 이슈**는 GitHub Issues에서 보고해주세요.
