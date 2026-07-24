@echo off
title 네이버 블로그 자동화 (감시 실행)

REM ============================================================
REM  네이버 블로그 자동화 - 감시(watchdog) 실행 스크립트
REM
REM  서버가 종료되면(오류 또는 UI의 재시작 버튼) 자동으로 다시 띄웁니다.
REM  UI의 "프로그램 재시작" 버튼은 프로세스를 종료시키고,
REM  이 루프가 그것을 감지해 새로 시작하는 구조입니다.
REM
REM  [인코딩] 이 파일은 반드시 CP949(ANSI)로 저장해야 합니다.
REM           UTF-8로 저장하면 cmd.exe가 한글을 깨뜨려 실행이 실패합니다.
REM ============================================================

cd /d "%~dp0.."

echo.
echo   네이버 블로그 자동화를 시작합니다
echo   주소: http://blog.ssyeonee27.com  (또는 http://localhost)
echo   이 창을 닫으면 서버가 종료됩니다.
echo.

REM 최초 1회 빌드 산출물이 없으면 빌드
if not exist ".next\BUILD_ID" (
  echo [준비] 최초 실행이라 빌드를 진행합니다. 잠시 기다려주세요...
  call npm run build
)

:loop
echo.
echo [%date% %time%] 서버 시작
call npm run start

echo.
echo [%date% %time%] 서버가 종료되었습니다. 3초 후 다시 시작합니다...
echo (완전히 끄려면 이 창을 닫으세요)
timeout /t 3 /nobreak > nul
goto loop
