-- blog_styles 테이블 생성
CREATE TABLE IF NOT EXISTS public.blog_styles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  style_content TEXT NOT NULL,
  analyzed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성 (user_id로 빠른 조회)
CREATE INDEX IF NOT EXISTS idx_blog_styles_user_id ON public.blog_styles(user_id);

-- 행 수준 보안 (RLS) 활성화
ALTER TABLE public.blog_styles ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 자신의 데이터에만 접근 가능
CREATE POLICY "Users can view their own blog styles"
  ON public.blog_styles
  FOR SELECT
  USING (TRUE);

CREATE POLICY "Users can update their own blog styles"
  ON public.blog_styles
  FOR UPDATE
  USING (TRUE);

CREATE POLICY "Users can insert their own blog styles"
  ON public.blog_styles
  FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "Users can delete their own blog styles"
  ON public.blog_styles
  FOR DELETE
  USING (TRUE);

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

-- 코멘트 추가
COMMENT ON TABLE public.blog_styles IS '사용자 블로그 스타일 저장소';
COMMENT ON COLUMN public.blog_styles.user_id IS '사용자 ID (고유값)';
COMMENT ON COLUMN public.blog_styles.style_content IS '분석된 블로그 스타일 내용';
COMMENT ON COLUMN public.blog_styles.analyzed_at IS '스타일 분석 시간';
