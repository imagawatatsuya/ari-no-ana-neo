import { test, expect } from 'playwright/test';

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test.describe('モバイル - 投稿画面', () => {
  test('タブ切替でプレビューできる', async ({ page }) => {
    await page.goto('/post');
    await page.locator('.form-table input[type="text"]').first().fill('モバイルテスト');
    await page.locator('.form-table textarea').fill('スマホからの投稿テスト本文');
    await page.getByRole('tab', { name: 'プレビュー' }).click();
    await expect(page.locator('.article-title')).toContainText('モバイルテスト');
    await expect(page.locator('.post-form-actions')).toBeVisible();
  });

  test('必須未入力時は投稿でインラインエラーが出る', async ({ page }) => {
    await page.goto('/post');
    await page.getByRole('tab', { name: 'プレビュー' }).click();
    await expect(page.getByRole('button', { name: '投稿する' })).toBeVisible();
    await page.getByRole('button', { name: '投稿する' }).click();
    await expect(page.locator('#post-error-title')).toBeVisible();
    await expect(page.locator('#post-error-body')).toBeVisible();
  });

  test('未入力でもプレビュータブに切り替えられる', async ({ page }) => {
    await page.goto('/post');
    await page.getByRole('tab', { name: 'プレビュー' }).click();
    await expect(page.locator('.article-title')).toContainText('タイトル未入力');
    await expect(page.locator('#post-error-title')).not.toBeVisible();
  });

  test('固定アクションバーが表示される', async ({ page }) => {
    await page.goto('/post');
    const actions = page.locator('.post-form-actions');
    await expect(actions).toBeVisible();
    const box = await actions.boundingBox();
    expect(box).not.toBeNull();
    const viewport = page.viewportSize();
    expect(box!.y + box!.height).toBeGreaterThan((viewport?.height ?? 0) - 80);
  });
});

test.describe('モバイル - 作品閲覧・コメント', () => {
  test('作品切替時に前のタイトルが残らない', async ({ page }) => {
    await page.goto('/');
    const links = page.locator('.entry-title-link');
    await expect(links.first()).toBeVisible();
    if (await links.count() < 2) {
      test.skip();
      return;
    }

    const title1 = (await links.nth(0).textContent())?.trim() ?? '';
    const title2 = (await links.nth(1).textContent())?.trim() ?? '';

    await links.nth(0).click();
    await expect(page.locator('.article-title')).toHaveText(title1);

    await page.locator('.back-link').first().click();
    await links.nth(1).click();
    await expect(page.locator('.article-title')).toHaveText(title2);
    await expect(page.locator('.article-title')).not.toHaveText(title1);
  });

  test('コメントフォームに文字数カウンターがある', async ({ page }) => {
    await page.goto('/');
    const firstLink = page.locator('.entry-title-link').first();
    await expect(firstLink).toBeVisible();
    await firstLink.click();
    await expect(page.locator('.comment-form-count')).toBeVisible();
    await page.locator('.comment-form textarea').fill('テストコメント');
    await expect(page.locator('.comment-form-count')).toContainText('7');
  });
});
