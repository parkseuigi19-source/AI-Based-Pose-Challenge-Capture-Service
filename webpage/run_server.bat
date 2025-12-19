@echo off
chcp 65001 >nul
REM ===============================
REM FastAPI 서버 실행 스크립트 (UTF-8 한글 지원)
REM ===============================

cd /d %~dp0

echo ========================================
echo     🚀 FastAPI 서버 실행 선택
echo ========================================
echo  1. 안정 모드 (reload 없음)
echo  2. 개발 모드 (reload 있음)
echo ========================================
set /p mode="👉 원하는 모드 번호 입력: "

REM 가상환경 활성화 (네 conda 경로 맞게 수정 필요)
call C:\Users\Admin\anaconda3\Scripts\activate.bat AIX_MINI_PROJECT_310

if "%mode%"=="1" (
    echo [안정 모드] 서버 실행 중...
    uvicorn main:app --host 127.0.0.1 --port 8000
    goto end
)

if "%mode%"=="2" (
    echo [개발 모드] 서버 실행 중...
    uvicorn main:app --host 127.0.0.1 --port 8000 --reload --reload-dir .
    goto end
)

echo 잘못된 입력입니다. 기본값(안정 모드)로 실행합니다.
uvicorn main:app --host 127.0.0.1 --port 8000

:end
pause
