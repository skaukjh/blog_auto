# data/

블로그 글 생성에 사용되는 데이터 파일 폴더입니다.

## blog-style.txt

`/format` 페이지에서 블로그 글 2개 이상을 분석하면 생성되는 **문체 정의 파일**입니다.
종결어미(`~~요` / `~~다` 등), 톤, 자주 쓰는 표현 등이 영문 프롬프트 형태로 저장됩니다.

이 파일을 읽는 곳:

- **A (글 생성)** — `lib/utils/style-storage.ts` → `/api/blog/get-current-style`, `/api/blog/analyze-style`
- **B (네이버 자동화)** — `automation/lib/utils/style-storage.ts` → 댓글 생성 시 문체 참조 (읽기 전용)

## Vercel 배포 시 주의

Vercel 함수의 파일시스템은 **읽기 전용**입니다. 따라서:

- 배포된 앱에서 `/format` 분석을 실행해도 `blog-style.txt` 는 갱신되지 않습니다.
  (분석 결과는 응답으로 돌아와 브라우저 `sessionStorage` 에 남으므로 그 세션 동안은 정상 동작합니다.)
- **스타일을 영구 반영하려면 로컬에서 분석 → 생성된 `blog-style.txt` 커밋 → 재배포** 순서로 진행하세요.

`next.config.ts` 의 `outputFileTracingIncludes` 설정으로 이 폴더가 배포 번들에 포함됩니다.
