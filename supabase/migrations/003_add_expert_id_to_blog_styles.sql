-- 전문가(expert)별로 문체를 따로 저장하기 위한 마이그레이션
--
-- 배경: 기존에는 user_id 하나당 문체 1개만 저장할 수 있었습니다.
--       맛집/제품/여행/리빙 전문가마다 예시글을 따로 받아 각자의 문체를
--       학습시키려면 (user_id, expert_id) 단위로 저장해야 합니다.
--
-- expert_id 값: 'restaurant' | 'product' | 'travel' | 'living' | 'common'
--   - 'common' 은 전문가 지정 없이 분석한 기존 문체이며, 전문가별 문체가
--     없을 때의 폴백으로 씁니다.

-- 1) expert_id 컬럼 추가 (기존 행은 모두 'common' 으로 편입)
ALTER TABLE public.blog_styles
  ADD COLUMN IF NOT EXISTS expert_id TEXT NOT NULL DEFAULT 'common';

-- 2) 기존의 user_id 단독 UNIQUE 제약 제거
--    제약 이름이 환경에 따라 다를 수 있어 카탈로그에서 찾아 제거합니다.
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'blog_styles'
    AND con.contype = 'u'
    AND con.conkey = ARRAY[
      (SELECT attnum FROM pg_attribute
        WHERE attrelid = rel.oid AND attname = 'user_id')
    ]::smallint[];

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.blog_styles DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

-- 3) (user_id, expert_id) 복합 UNIQUE 제약 추가
--    upsert 가 이 제약을 기준으로 동작합니다.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'blog_styles_user_id_expert_id_key'
  ) THEN
    ALTER TABLE public.blog_styles
      ADD CONSTRAINT blog_styles_user_id_expert_id_key UNIQUE (user_id, expert_id);
  END IF;
END $$;

-- 4) 조회 인덱스 교체
DROP INDEX IF EXISTS public.idx_blog_styles_user_id;
CREATE INDEX IF NOT EXISTS idx_blog_styles_user_expert
  ON public.blog_styles(user_id, expert_id);

-- 5) 분석에 사용한 예시글 수를 기록 (선택 정보, UI 표시용)
ALTER TABLE public.blog_styles
  ADD COLUMN IF NOT EXISTS sample_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.blog_styles.expert_id IS
  '전문가 구분: restaurant | product | travel | living | common(전문가 미지정 폴백)';
COMMENT ON COLUMN public.blog_styles.sample_count IS '이 문체를 분석할 때 사용한 예시글 개수';
