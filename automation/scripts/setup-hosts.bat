@echo off
title hosts 파일 설정 - 관리자 권한 필요

REM ============================================================
REM  blog.ssyeonee27.com 을 이 PC로 연결합니다.
REM
REM  [주의] 반드시 이 파일을 우클릭 - "관리자 권한으로 실행" 하세요.
REM         hosts 파일은 관리자만 수정할 수 있습니다.
REM
REM  [주의] 이 설정은 이 PC에서만 적용됩니다.
REM         다른 기기나 외부에서는 이 주소로 접속할 수 없습니다.
REM
REM  [인코딩] 이 파일은 반드시 CP949(ANSI)로 저장해야 합니다.
REM           UTF-8로 저장하면 cmd.exe가 한글을 깨뜨려 실행이 실패합니다.
REM ============================================================

net session >nul 2>&1
if %errorLevel% neq 0 (
  echo.
  echo   [오류] 관리자 권한이 없습니다.
  echo   이 파일을 우클릭 - "관리자 권한으로 실행" 을 선택하세요.
  echo.
  pause
  exit /b 1
)

set HOSTS=%SystemRoot%\System32\drivers\etc\hosts
set DOMAIN=blog.ssyeonee27.com

findstr /C:"%DOMAIN%" "%HOSTS%" >nul 2>&1
if %errorLevel% equ 0 (
  echo.
  echo   이미 등록되어 있습니다: %DOMAIN%
  echo.
  findstr /C:"%DOMAIN%" "%HOSTS%"
  echo.
  pause
  exit /b 0
)

REM hosts 파일에 추가 (한 줄이라도 실패하면 아래에서 검증으로 걸러집니다)
>> "%HOSTS%" echo.
>> "%HOSTS%" echo # 네이버 블로그 자동화 로컬 접속용
>> "%HOSTS%" echo 127.0.0.1    %DOMAIN%

REM 실제로 기록됐는지 다시 확인 (echo의 errorLevel은 신뢰할 수 없음)
findstr /C:"%DOMAIN%" "%HOSTS%" >nul 2>&1
if %errorLevel% equ 0 (
  echo.
  echo   [완료] %DOMAIN% 등록됨
  echo.
  echo   DNS 캐시를 정리합니다...
  ipconfig /flushdns >nul
  echo.
  echo   이제 브라우저에서 http://%DOMAIN% 으로 접속할 수 있습니다.
  echo   (자동화 프로그램이 실행 중이어야 합니다)
  echo.
) else (
  echo.
  echo   [오류] hosts 파일 수정에 실패했습니다.
  echo   백신 프로그램이 hosts 수정을 차단했을 수 있습니다.
  echo.
)

pause
