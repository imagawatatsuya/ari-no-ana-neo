import { test, expect } from 'playwright/test';

test('online admin checks membership and clears hidden reads after logout', async ({ page }) => {
  let administrator = false;
  await page.context().route('http://127.0.0.1:54329/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/token')) {
      const { email } = route.request().postDataJSON();
      administrator = email === 'admin@example.test';
      const id = administrator ? '00000000-0000-0000-0000-000000000001' : '00000000-0000-0000-0000-000000000002';
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const token = [btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), btoa(JSON.stringify({ sub: id, exp, role: 'authenticated' })), 'test-signature'].join('.');
      await route.fulfill({ json: { access_token: token, refresh_token: 'test-refresh', expires_in: 3600, token_type: 'bearer', user: { id, email, aud: 'authenticated', role: 'authenticated' } } });
    } else if (url.pathname.endsWith('/logout')) {
      administrator = false;
      await route.fulfill({ status: 204 });
    } else if (url.pathname.endsWith('/admin_users')) {
      await route.fulfill({ json: administrator ? { user_id: '00000000-0000-0000-0000-000000000001' } : null });
    } else if (url.pathname.endsWith('/novels') && url.searchParams.has('id')) {
      await route.fulfill(administrator ? { json: { id: 'hidden-1', title: '管理者だけの作品', body: '非表示本文', author: '作者', date: '2026-01-01T00:00:00Z', is_hidden: true, is_ryuseigai: false, view_count: 0 } } : { status: 406, json: { code: 'PGRST116', message: 'No rows' } });
    } else if (url.pathname.endsWith('/rpc/increment_novel_view')) {
      await route.fulfill({ status: 204 });
    } else {
      await route.fulfill({ json: [] });
    }
  });
  await page.goto('/admin');
  await page.locator('input[type="email"]').fill('reader@example.test');
  await page.locator('input[type="password"]').fill('test-password');
  await page.getByRole('button', { name: 'ログイン', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('管理者権限を確認できません');
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await page.locator('input[type="email"]').fill('admin@example.test');
  await page.locator('input[type="password"]').fill('test-password');
  await page.getByRole('button', { name: 'ログイン', exact: true }).click();
  await expect(page.getByRole('button', { name: '>>ログアウト', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'アリの穴NEO', exact: true }).click();
  // Change route without reloading the application, so the cache stays in scope.
  await page.evaluate(() => { history.pushState({}, '', '/read/hidden-1'); window.dispatchEvent(new PopStateEvent('popstate')); });
  await expect(page.locator('.article-title')).toHaveText('管理者だけの作品');
  const otherTab = await page.context().newPage();
  await otherTab.goto('/');
  await otherTab.getByRole('button', { name: '>>ログアウト', exact: true }).click();
  await expect(page.locator('.article-title')).toHaveCount(0);
  await page.evaluate(() => { history.pushState({}, '', '/read/hidden-1'); window.dispatchEvent(new PopStateEvent('popstate')); });
  await expect(page.getByText('投稿が見つからないか、非表示に設定されています。', { exact: false })).toBeVisible();
  await expect(page.getByText('非表示本文', { exact: true })).toHaveCount(0);
  await otherTab.close();
});

test('online reader revalidates edits, comments and visibility across visits', async ({ page }) => {
  await page.clock.install();
  let title = '公開作品';
  let hidden = false;
  let comments: Array<Record<string, unknown>> = [];
  let reads = 0;
  await page.route('http://127.0.0.1:54329/**', async (route) => {
    const url = new URL(route.request().url());
    const novel = { id: 'online-1', title, author: '作者', body: '公開本文です。', date: '2026-01-01T00:00:00Z', view_count: 0, is_hidden: false, is_ryuseigai: false, author_indent_mode: 'raw', author_message: null, description: null, trip: null };
    if (url.pathname.endsWith('/rpc/list_public_novels')) {
      await route.fulfill({ json: hidden ? [] : [{ ...novel, total_count: 1, comment_count: comments.length, vote_count: 0, vote_sum: 0 }] });
    } else if (url.pathname.endsWith('/rpc/increment_novel_view')) {
      await route.fulfill({ status: 204 });
    } else if (url.pathname.endsWith('/novels')) {
      reads += 1;
      await route.fulfill(hidden ? { status: 406, json: { code: 'PGRST116', message: 'No rows' } } : { json: novel });
    } else if (url.pathname.endsWith('/comments')) {
      await route.fulfill({ json: comments });
    } else {
      await route.fulfill({ json: [] });
    }
  });
  await page.goto('/read/online-1');
  await expect(page.locator('.article-title')).toHaveText(title);
  await expect.poll(() => reads).toBeGreaterThan(0);
  await page.locator('.back-link').first().click();
  await expect(page.locator('.entry-title-link').first()).toBeVisible();
  title = '他端末で編集した作品';
  comments = [{ id: 'new-comment', novel_id: 'online-1', name: '読者', text: '別の端末からの感想', date: '2026-01-02T00:00:00Z', vote: null }];
  await page.locator('.entry-title-link').first().click();
  await expect(page.locator('.article-title')).toHaveText(title);
  await expect(page.getByText('別の端末からの感想', { exact: true })).toBeVisible();
  title = '開いたままの作品も更新';
  await page.clock.fastForward(30_000);
  await expect(page.locator('.article-title')).toHaveText(title);
  hidden = true;
  // Resuming a tab rechecks visibility even when an entry is still cached.
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('.article-title')).toHaveCount(0);
  await expect(page.getByText('投稿が見つからないか、非表示に設定されています。', { exact: false })).toBeVisible();
});
