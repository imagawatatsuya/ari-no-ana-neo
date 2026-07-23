@echo off
chcp 65001 >nul
title APIキーを保存

echo ============================================
echo   GEMINI_API_KEY を保存
echo ============================================
echo.

npx tsx scripts/manage-key.ts store

echo.
echo ============================================
pause
