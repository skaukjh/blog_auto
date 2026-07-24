-- 글쓰기 가이드에 "종결어미 지배" 정보를 추가
--
-- 배경(2026-07-24 사용자 결정): 참고 자료(케넨)의 문체 기준을 전역 기본으로 삼되,
--   **학습된 전문가 문체의 종결어미까지 이 자료가 덮어쓴다.**
--   즉 가이드에 종결어미가 지정돼 있으면, 그 어미가 blog_styles의 어미보다 우선합니다.
--
-- ⚠️ 이 컬럼이 NULL이면 기존 동작(학습 문체의 어미를 따름)을 유지합니다.
--   값이 '요' 또는 '다'면 모든 글이 그 어미로 강제됩니다.
--
-- ⚠️ 이는 CLAUDE.md의 "종결어미 일관성(학습 문체 우선)" 규칙을 의도적으로 뒤집는
--   것입니다. 되돌리기 전에 반드시 사용자에게 확인하세요.

ALTER TABLE public.writing_guides
  ADD COLUMN IF NOT EXISTS ending_pattern TEXT;

COMMENT ON COLUMN public.writing_guides.ending_pattern IS
  '이 값(요/다)이 있으면 학습 문체를 무시하고 모든 글을 이 종결어미로 강제합니다. NULL이면 학습 문체를 따릅니다.';
