-- 예시글이 바뀌지 않았으면 OpenAI 재분석을 건너뛰기 위한 마이그레이션
--
-- 배경: /format 의 분석 버튼은 누를 때마다 OpenAI를 호출했습니다.
--       예시글을 하나도 고치지 않고 다시 눌러도 똑같은 분석에 비용이 또 나갔습니다.
--       분석에 사용한 예시글의 지문(해시)을 함께 저장해 두고, 다음 요청의 지문과
--       같으면 저장된 결과를 그대로 돌려줍니다.
--
-- 해시는 서버에서 계산합니다 (app/api/blog/analyze-style/route.ts).
-- 제목은 UI가 자동 생성하는 값이라 제외하고, 본문만 정규화해서 넣습니다.

ALTER TABLE public.blog_styles
  ADD COLUMN IF NOT EXISTS samples_hash TEXT;

COMMENT ON COLUMN public.blog_styles.samples_hash IS
  '이 문체를 분석할 때 사용한 예시글 본문의 SHA-256 지문. 같으면 재분석을 건너뜁니다';

-- 분석에 사용한 예시글 원문도 함께 보관합니다.
--
-- /format 화면을 떠났다 돌아왔을 때 지난번에 넣은 예시글을 그대로 다시 띄우기
-- 위한 용도입니다. 문자열 배열을 JSONB로 저장합니다.
ALTER TABLE public.blog_styles
  ADD COLUMN IF NOT EXISTS samples JSONB;

COMMENT ON COLUMN public.blog_styles.samples IS
  '분석에 사용한 예시글 원문 배열. /format 재방문 시 입력창 복원에 씁니다';
