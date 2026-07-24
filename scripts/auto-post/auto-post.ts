#!/usr/bin/env node
/**
 * AI自動投稿ツール
 * Gemini API で指定文字数の小説を生成し、Supabase に自動投稿する。
 *
 * 実行例:
 *   npx tsx scripts/auto-post/auto-post.ts 3000
 *   npx tsx scripts/auto-post/auto-post.ts 3000 "消化器官のコメディ"
 *
 * 環境変数 (.env.local):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 *   GEMINI_API_KEY
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ── .credentials.json を読み込む ──────────────────────────────────
function loadCredentials(): Record<string, string> {
  const credPath = resolve(process.cwd(), '.credentials.json');
  if (!existsSync(credPath)) return {};
  try {
    return JSON.parse(readFileSync(credPath, 'utf-8'));
  } catch {
    return {};
  }
}

// ── .env.local を読み込む ──────────────────────────────────────────
function loadEnv(): Record<string, string> {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return {};
  const raw = readFileSync(envPath, 'utf-8');
  const env: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    env[key] = val;
  }
  return env;
}

// ── 文字数カウント（countBodyCharacters と同等） ──────────────────
function countBodyCharacters(text: string): number {
  if (!text) return 0;
  return text.replace(/[\n\r \u3000\t]/g, '').length;
}

// ── Gemini プロンプト生成 ─────────────────────────────────────────
function buildPrompt(targetChars: number, theme?: string, retryInfo?: { prevChars: number; attempt: number }): string {
  const themeLine = theme ? `テーマ: ${theme}\n` : '';

  if (retryInfo) {
    return `${themeLine}目标: 改行と空白を除いた本文の文字数が正確に ${targetChars} 文字の日本語小説を書いてください。
前回あなたの生成は ${retryInfo.prevChars} 文字でした（${retryInfo.attempt}回目）。
今回は必ず正確に ${targetChars} 文字にしてください。
タイトルは最初の1行に「タイトル: ○○」の形式で書いてください。
本文は2行目以降に書いてください。`;
  }

  return `${themeLine}改行と空白を除いた本文の文字数が正確に ${targetChars} 文字の日本語短編小説を書いてください。
タイトルは最初の1行に「タイトル: ○○」の形式で書いてください。
本文は2行目以降に書いてください。
文字数は厳密に ${targetChars} 文字にしてください。これが最も重要な要件です。`;
}

// ── Gemini レスポンス解析 ──────────────────────────────────────────
function parseResponse(text: string): { title: string; body: string } {
  const lines = text.split('\n');
  let title = '無題';
  let bodyStartIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('タイトル:') || line.startsWith('タイトル：')) {
      title = line.replace(/^タイトル[:：]\s*/, '').trim() || '無題';
      bodyStartIdx = i + 1;
      break;
    }
  }

  const body = lines.slice(bodyStartIdx).join('\n').trim();
  return { title, body };
}

// ── メイン処理 ─────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('使い方: npx tsx scripts/auto-post/auto-post.ts <目標文字数> [テーマ]');
    console.log('例: npx tsx scripts/auto-post/auto-post.ts 3000 "消化器官のコメディ"');
    process.exit(1);
  }

  const targetChars = parseInt(args[0], 10);
  if (isNaN(targetChars) || targetChars <= 0) {
    console.error('エラー: 目標文字数は正の整数を指定してください。');
    process.exit(1);
  }

  const theme = args[1] || undefined;

  // 環境変数読み込み（.credentials.json 優先、.env.local はフォールバック）
  const env = loadEnv();
  const creds = loadCredentials();
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseKey = env.VITE_SUPABASE_ANON_KEY;
  const geminiKey = creds.GEMINI_API_KEY || env.GEMINI_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('エラー: .env.local に VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を設定してください。');
    process.exit(1);
  }
  if (!geminiKey) {
    console.error('エラー: GEMINI_API_KEY が見つかりません。');
    console.error('  scripts\\auto-post\\save-key.bat を実行してキーを保存してください。');
    process.exit(1);
  }

  // クライアント初期化
  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash-lite' });
  const supabase = createClient(supabaseUrl, supabaseKey);

  const MAX_RETRIES = 4;
  let bestBody = '';
  let bestTitle = '';
  let bestDiff = Infinity;

  console.log(`目標文字数: ${targetChars}字${theme ? ` / テーマ: ${theme}` : ''}`);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`\n--- 試行 ${attempt}/${MAX_RETRIES} ---`);

    const retryInfo = attempt > 1
      ? { prevChars: countBodyCharacters(bestBody), attempt: attempt - 1 }
      : undefined;

    const prompt = buildPrompt(targetChars, theme, retryInfo);

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      const { title, body } = parseResponse(text);
      const charCount = countBodyCharacters(body);
      const diff = Math.abs(charCount - targetChars);

      console.log(`生成文字数: ${charCount}字 (差分: ${charCount - targetChars >= 0 ? '+' : ''}${charCount - targetChars})`);

      if (diff < bestDiff) {
        bestDiff = diff;
        bestBody = body;
        bestTitle = title;
      }

      if (charCount === targetChars) {
        console.log('✓ 目標文字数に一致！');
        break;
      }

      if (attempt < MAX_RETRIES) {
        console.log(`✗ 不一致。リトライします...`);
      }
    } catch (err: any) {
      console.error(`Gemini API エラー: ${err.message}`);
      if (attempt < MAX_RETRIES) {
        console.log('リトライします...');
      }
    }
  }

  if (!bestBody) {
    console.error('エラー: テキスト生成に失敗しました。');
    process.exit(1);
  }

  const finalCount = countBodyCharacters(bestBody);
  console.log(`\n=== 投稿内容 ===`);
  console.log(`タイトル: ${bestTitle}`);
  console.log(`文字数: ${finalCount}字 (目標: ${targetChars}字)`);
  console.log(`本文先頭: ${bestBody.slice(0, 60)}...`);

  // Supabase に投稿
  const description = bestBody.replace(/[\n\r \u3000\t]/g, '').slice(0, 100);

  const { error } = await supabase.from('novels').insert({
    title: bestTitle,
    author: '名無し',
    body: bestBody,
    description,
    date: new Date().toISOString().split('T')[0],
    is_hidden: false,
    is_ryuseigai: false,
  });

  if (error) {
    console.error(`\n投稿失敗: ${error.message}`);
    process.exit(1);
  }

  console.log('\n✓ 投稿完了！');
}

main().catch((err) => {
  console.error('予期しないエラー:', err);
  process.exit(1);
});
