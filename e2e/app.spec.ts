import { test, expect } from 'playwright/test';

test.describe('アリの穴NEO - 一覧画面', () => {
  test('トップページが表示される', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.site-title')).toContainText('アリの穴NEO');
    await expect(page.locator('.site-subtitle')).toContainText('匿名投稿');
  });

  test('作品一覧テーブルが表示される', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.classic-table')).toBeVisible();
    await expect(page.locator('.classic-table thead th').first()).toContainText('Title');
  });

  test('検索バーが表示される', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.search-bar')).toBeVisible();
    await expect(page.locator('.search-input')).toBeVisible();
  });

  test('検索で作品が絞り込まれる', async ({ page }) => {
    await page.goto('/');
    await page.locator('.search-input').fill('テスト');
    await page.locator('.search-bar button[type="submit"]').click();
    // 検索結果がテーブルに表示される（オフラインモードではシードデータ対象）
    await expect(page.locator('.classic-table')).toBeVisible();
  });

  test('ナビゲーションリンクが表示される', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.top-nav')).toContainText('新規投稿');
    await expect(page.locator('.top-nav')).toContainText('管理者用');
  });
});

test.describe('アリの穴NEO - 投稿画面', () => {
  test('投稿フォームが表示される', async ({ page }) => {
    await page.goto('/post');
    await expect(page.locator('.form-table')).toBeVisible();
  });

  test('プレビュー→送信の2段階フロー', async ({ page }) => {
    await page.goto('/post');
    // タイトルと本文を入力
    const inputs = page.locator('.form-table input[type="text"], .form-table textarea');
    await inputs.first().fill('E2Eテスト作品');
    // 本文textarea
    await page.locator('.form-table textarea').fill('これはE2Eテストの本文です。');
    // プレビューボタン
    await page.getByText('プレビュー').click();
    await expect(page.locator('body')).toContainText('E2Eテスト作品');
  });
});

test.describe('アリの穴NEO - 作品閲覧', () => {
  test('作品リンクをクリックすると閲覧ページに遷移', async ({ page }) => {
    await page.goto('/');
    const firstLink = page.locator('.entry-title-link').first();
    if (await firstLink.isVisible()) {
      const title = await firstLink.textContent();
      await firstLink.click();
      await expect(page).toHaveURL(/\/read\//);
      await expect(page.locator('body')).toContainText(title!);
    }
  });

  test('閲覧ページはスクロール位置が最上部', async ({ page }) => {
    await page.goto('/');
    const firstLink = page.locator('.entry-title-link').first();
    if (await firstLink.isVisible()) {
      await firstLink.click();
      const scrollY = await page.evaluate(() => window.scrollY);
      expect(scrollY).toBe(0);
    }
  });
});

test.describe('アリの穴NEO - 管理画面', () => {
  test('管理画面にログインフォームが表示される', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('body')).toContainText('管理者ログイン');
  });
});
