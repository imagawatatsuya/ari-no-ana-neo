@echo off
chcp 65001 >nul
title AI自動投稿ツール

cd /d "%~dp0..\.."

echo ============================================
echo   文章アリの穴NEO - AI自動投稿ツール
echo ============================================
echo.

rem .credentials.json から APIキーを読み込む
if exist .credentials.json (
    for /f "tokens=2 delims=:, " %%a in ('findstr "GEMINI_API_KEY" .credentials.json') do set "GEMINI_API_KEY=%%~a"
)
if "%GEMINI_API_KEY%"=="" (
    echo [エラー] GEMINI_API_KEY が見つかりません。
    echo   scripts\auto-post\save-key.bat を実行してキーを保存してください。
    echo.
    pause
    exit /b 1
)

set /p CHARS="目標文字数を入力してください: "
set /p THEME="テーマ（任意、Enterでスキップ）: "

if "%THEME%"=="" (
    echo.
    echo 実行中: %CHARS%字の小説を生成します...
    echo.
    npx tsx scripts/auto-post/auto-post.ts %CHARS%
) else (
    echo.
    echo 実行中: %CHARS%字「%THEME%」の小説を生成します...
    echo.
    npx tsx scripts/auto-post/auto-post.ts %CHARS% "%THEME%"
)

echo.
echo ============================================
pause
