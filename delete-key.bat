@echo off
chcp 65001 >nul
title APIキーを削除

echo ============================================
echo   GEMINI_API_KEY を削除
echo ============================================
echo.

npx tsx scripts/manage-key.ts delete

echo.
echo ============================================
pause
