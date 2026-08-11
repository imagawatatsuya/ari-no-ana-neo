@echo off
chcp 65001 >nul
title APIキーを保存

cd /d "%~dp0..\.."

echo ============================================
echo   GEMINI_API_KEY を保存
echo ============================================
echo.

npx tsx scripts/auto-post/manage-key.ts store

echo.
echo ============================================
pause
