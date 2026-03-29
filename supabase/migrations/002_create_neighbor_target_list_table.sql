-- neighbor_target_list 테이블 생성 (댓글 대상 닉네임 목록)
CREATE TABLE IF NOT EXISTS public.neighbor_target_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  nicknames TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성 (user_id로 빠른 조회)
CREATE INDEX IF NOT EXISTS idx_neighbor_target_list_user_id ON public.neighbor_target_list(user_id);

-- 행 수준 보안 (RLS) 활성화
ALTER TABLE public.neighbor_target_list ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 자신의 데이터에만 접근 가능
CREATE POLICY "Users can view their own target list"
  ON public.neighbor_target_list
  FOR SELECT
  USING (TRUE);

CREATE POLICY "Users can update their own target list"
  ON public.neighbor_target_list
  FOR UPDATE
  USING (TRUE);

CREATE POLICY "Users can insert their own target list"
  ON public.neighbor_target_list
  FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "Users can delete their own target list"
  ON public.neighbor_target_list
  FOR DELETE
  USING (TRUE);

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_neighbor_target_list_updated_at BEFORE UPDATE ON public.neighbor_target_list
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 코멘트 추가
COMMENT ON TABLE public.neighbor_target_list IS '댓글 대상 이웃 블로거 닉네임 목록';
COMMENT ON COLUMN public.neighbor_target_list.user_id IS '사용자 ID (고유값)';
COMMENT ON COLUMN public.neighbor_target_list.nicknames IS '대상 닉네임 배열 (예: ["jinhee-yoo", "ssomdd123kr"])';
