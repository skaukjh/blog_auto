@echo off
chcp 65001 > nul
title 부팅 자동 실행 등록 - 관리자 권한 필요

REM ============================================================
REM  윈도우 로그인 시 자동화 프로그램이 자동으로 뜨도록 등록합니다.
REM
REM  ⚠️ 우클릭 → "관리자 권한으로 실행" 하세요.
REM     80번 포트를 쓰려면 관리자 권한이 필요합니다.
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

set TASKNAME=NaverBlogAutomation
set SCRIPT=%~dp0start-automation.bat

echo.
echo   실행 스크립트: %SCRIPT%
echo.

schtasks /query /tn "%TASKNAME%" >nul 2>&1
if %errorLevel% equ 0 (
  echo   기존 등록을 제거합니다...
  schtasks /delete /tn "%TASKNAME%" /f >nul
)

schtasks /create ^
  /tn "%TASKNAME%" ^
  /tr "\"%SCRIPT%\"" ^
  /sc onlogon ^
  /rl highest ^
  /f

if %errorLevel% equ 0 (
  echo.
  echo   [완료] 로그인 시 자동 실행이 등록되었습니다.
  echo.
  echo   - 등록 확인 : schtasks /query /tn "%TASKNAME%"
  echo   - 지금 실행 : schtasks /run   /tn "%TASKNAME%"
  echo   - 등록 해제 : schtasks /delete /tn "%TASKNAME%" /f
  echo.
) else (
  echo.
  echo   [오류] 작업 등록에 실패했습니다.
  echo.
)

pause
