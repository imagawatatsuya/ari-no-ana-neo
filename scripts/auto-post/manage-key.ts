#!/usr/bin/env node
/**
 * API キー管理ツール
 * .credentials.json に GEMINI_API_KEY を保存・削除する。
 *
 * 実行例:
 *   npx tsx scripts/auto-post/manage-key.ts store    # APIキーを保存
 *   npx tsx scripts/auto-post/manage-key.ts delete    # APIキーを削除
 *   npx tsx scripts/auto-post/manage-key.ts status    # 保存状態を確認
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync, chmodSync } from 'fs';
import { resolve } from 'path';
import { createInterface } from 'readline';

const CRED_PATH = resolve(process.cwd(), '.credentials.json');

function readCredentials(): Record<string, string> {
  if (!existsSync(CRED_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CRED_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function writeCredentials(creds: Record<string, string>): void {
  writeFileSync(CRED_PATH, JSON.stringify(creds, null, 2), 'utf-8');
  // Windows以外ではパーミッションを600に設定
  try { chmodSync(CRED_PATH, 0o600); } catch { /* Windows では無視 */ }
}

async function promptSecret(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    // 入力エコーを無効化（Windowsでは完全にはマスクできないが簡易対応）
    if (process.stdout.isTTY) {
      process.stdout.write(question);
      const stdin = process.stdin as any;
      const wasRaw = stdin.isRaw;
      if (stdin.setRawMode) stdin.setRawMode(true);
      let input = '';
      const onData = (ch: Buffer) => {
        const c = ch.toString('utf-8');
        if (c === '\n' || c === '\r' || c === '\u0004') {
          if (stdin.setRawMode) stdin.setRawMode(wasRaw);
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          rl.close();
          resolve(input);
        } else if (c === '\u0003') {
          process.exit();
        } else if (c === '\u007f' || c === '\b') {
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          input += c;
          process.stdout.write('*');
        }
      };
      stdin.on('data', onData);
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

async function cmdStore(): Promise<void> {
  const key = await promptSecret('GEMINI_API_KEY を入力してください: ');
  if (!key.trim()) {
    console.error('エラー: キーが空です。');
    process.exit(1);
  }
  const creds = readCredentials();
  creds.GEMINI_API_KEY = key.trim();
  writeCredentials(creds);
  console.log('✓ GEMINI_API_KEY を .credentials.json に保存しました。');
}

function cmdDelete(): void {
  if (!existsSync(CRED_PATH)) {
    console.log('.credentials.json が存在しません。削除するものがありません。');
    return;
  }
  const creds = readCredentials();
  delete creds.GEMINI_API_KEY;
  if (Object.keys(creds).length === 0) {
    unlinkSync(CRED_PATH);
    console.log('✓ .credentials.json を削除しました。');
  } else {
    writeCredentials(creds);
    console.log('✓ GEMINI_API_KEY を削除しました。');
  }
}

function cmdStatus(): void {
  if (!existsSync(CRED_PATH)) {
    console.log('.credentials.json: 未作成');
    return;
  }
  const creds = readCredentials();
  const key = creds.GEMINI_API_KEY;
  if (key) {
    const masked = key.slice(0, 4) + '****' + key.slice(-4);
    console.log(`.credentials.json: 保存済み (${masked})`);
  } else {
    console.log('.credentials.json: GEMINI_API_KEY 未設定');
  }
}

async function main(): Promise<void> {
  const cmd = process.argv[2];

  switch (cmd) {
    case 'store':
      await cmdStore();
      break;
    case 'delete':
      cmdDelete();
      break;
    case 'status':
      cmdStatus();
      break;
    default:
      console.log('使い方:');
      console.log('  npx tsx scripts/auto-post/manage-key.ts store   - APIキーを保存');
      console.log('  npx tsx scripts/auto-post/manage-key.ts delete   - APIキーを削除');
      console.log('  npx tsx scripts/auto-post/manage-key.ts status   - 保存状態を確認');
      process.exit(cmd ? 1 : 0);
  }
}

main().catch((err) => {
  console.error('エラー:', err);
  process.exit(1);
});
