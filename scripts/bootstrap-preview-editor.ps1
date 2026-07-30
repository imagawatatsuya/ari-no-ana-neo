# ari-preview-editor の初回セットアップ（一度だけ実行）
# 使い方: pwsh scripts/bootstrap-preview-editor.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

$temp = Join-Path $env:TEMP "ari-preview-editor-bootstrap"
if (Test-Path $temp) { Remove-Item -Recurse -Force $temp }

Write-Host "Cloning ari-preview-editor..."
git clone https://github.com/imagawatatsuya/ari-preview-editor.git $temp

New-Item -ItemType Directory -Force -Path "$temp/styles" | Out-Null
Copy-Item "$root/components/FootnoteRenderer.tsx" "$temp/components/FootnoteRenderer.tsx" -Force
Copy-Item "$root/styles/footnote-renderer.css" "$temp/styles/footnote-renderer.css" -Force

@'
@import "tailwindcss";

/* Typographyプラグインを読み込む */
@plugin "@tailwindcss/typography";

/* 以下はv4の標準的な設定 */
@theme {
  --font-sans: "Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif;
}

/* 本体設定（背景色など） */
body {
  background-color: var(--color-gray-50);
  color: var(--color-gray-900);
}

/* ari-no-ana-neo から自動同期（手動編集しない） */
@import "../styles/footnote-renderer.css";
'@ | Set-Content -Path "$temp/app/globals.css" -Encoding utf8NoBOM

Push-Location $temp
git add app/globals.css components/FootnoteRenderer.tsx styles/footnote-renderer.css
git commit -m "chore: bootstrap editor sync from ari-no-ana-neo"
git push
Pop-Location

Write-Host "Done. preview-editor is ready for GitHub Actions sync."
