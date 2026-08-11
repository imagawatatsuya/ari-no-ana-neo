@echo off
chcp 65001 >nul
title APIキーを削除

cd /d "%~dp0..\.."

echo ============================================
echo   GEMINI_API_KEY を削除
echo ============================================
echo.

npx tsx scripts/auto-post/manage-key.ts delete

echo.
echo ============================================
pause
