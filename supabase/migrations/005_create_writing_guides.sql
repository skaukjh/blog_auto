-- 글쓰기 가이드(포맷·구성 규칙) 저장 테이블
--
-- 배경: 문체(blog_styles)는 "어떻게 쓰는가"이고, 이 테이블은 "어떤 구조로 쓰는가"입니다.
--       참고 자료(전자책 PDF, 프롬프트 자료집 URL)를 한 번만 분석해 여기에 저장해 두고,
--       글 생성 때마다 읽어서 프롬프트에 넣습니다. 매번 재분석하지 않습니다.
--
-- ⚠️ 원본 자료는 제3자 저작물입니다. 여기에는 원문이 아니라 분석해서 뽑아낸
--    구조·규칙 요약만 저장합니다. 원문 전재는 하지 않습니다.
--
-- ⚠️ 종결어미·말투는 이 가이드에 넣지 않습니다. 그건 blog_styles 가 담당하며,
--    참고 자료의 문체 지침("~했어요" 등)이 학습된 문체를 덮어쓰면 안 됩니다.

CREATE TABLE IF NOT EXISTS public.writing_guides (
  id           BIGSERIAL PRIMARY KEY,
  user_id      TEXT NOT NULL DEFAULT 'default',

  -- 분석 결과 (프롬프트에 그대로 들어갑니다)
  guide_content TEXT NOT NULL,

  -- 어떤 자료로 만들었는지 (파일명·URL 목록)
  sources      JSONB,
  -- 자료 지문. 같으면 재분석을 건너뜁니다
  sources_hash TEXT,

  analyzed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT writing_guides_user_id_key UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_writing_guides_user ON public.writing_guides(user_id);

-- blog_styles 와 동일한 정책을 씁니다 (단일 사용자 전제).
-- 다중 사용자로 확장한다면 user_id 기준으로 반드시 다시 짜야 합니다.
ALTER TABLE public.writing_guides ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'writing_guides'
      AND policyname = 'writing_guides_all'
  ) THEN
    CREATE POLICY writing_guides_all ON public.writing_guides
      FOR ALL USING (TRUE) WITH CHECK (TRUE);
  END IF;
END $$;

COMMENT ON TABLE public.writing_guides IS
  '글 구조·포맷 가이드. 참고 자료를 한 번 분석한 결과를 보관합니다 (문체는 blog_styles)';
COMMENT ON COLUMN public.writing_guides.sources_hash IS
  '참고 자료의 SHA-256 지문. 같으면 재분석을 건너뜁니다';
