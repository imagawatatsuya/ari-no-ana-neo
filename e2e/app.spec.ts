import { test, expect } from 'playwright/test';

test.describe('アリの穴NEO - 一覧画面', () => {
  test('トップページが表示される', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.site-title')).toContainText('アリの穴NEO');
    await expect(page.locator('.site-subtitle')).toContainText('匿名投稿');
  });

  test('作品一覧テーブルが表示される', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.classic-table, .list-status-message')).toBeVisible();
    await expect(page.locator('.classic-table thead th').first()).toContainText('Title');
  });

  test('初回ロード中に空一覧メッセージを誤表示しない', async ({ page }) => {
    await page.goto('/');
    const loadingMsg = page.getByText('作品一覧を読み込んでいます……');
    const emptyMsg = page.getByText('投稿がありません。');
    if (await loadingMsg.isVisible()) {
      await expect(emptyMsg).not.toBeVisible();
    }
    await expect(
      page.locator('.classic-table, .list-status-error, .list-status-message'),
    ).toBeVisible();
  });

  test('検索バーが表示される', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.search-bar')).toBeVisible();
    await expect(page.locator('.search-input')).toBeVisible();
  });

  test('設定 / ヘルプから字下げ設定を変更できる', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /設定 \/ ヘルプ/ }).click();
    await expect(page.getByRole('heading', { name: '字下げ設定' })).toBeVisible();
    await page.getByRole('radio', { name: '自動字下げあり' }).check();
    await expect(page.getByRole('radio', { name: '自動字下げあり' })).toBeChecked();
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
    await expect(page.locator('.post-form-tabs')).toBeVisible();
    await expect(page.getByPlaceholder('名無し')).toBeVisible();
  });

  test('入力内容は下書きとして復元でき、クリアで消える', async ({ page }) => {
    await page.goto('/post');
    await expect(page.locator('.post-form-note')).toContainText('下書きとして自動保存');
    await page.locator('.form-table input[type="text"]').first().fill('下書きタイトル');
    await page.locator('.form-table textarea[maxlength="100000"]').fill('下書き本文');
    await page.locator('.post-form-back').click();
    await page.getByRole('link', { name: /新規投稿/ }).click();
    await expect(page.locator('.form-table input[type="text"]').first()).toHaveValue('下書きタイトル');
    await expect(page.locator('.form-table textarea[maxlength="100000"]')).toHaveValue('下書き本文');
    await page.getByRole('button', { name: 'クリア' }).click();
    await expect(page.locator('.form-table input[type="text"]').first()).toHaveValue('');
    await expect(page.locator('.form-table textarea[maxlength="100000"]')).toHaveValue('');
    await page.locator('.post-form-back').click();
    await page.getByRole('link', { name: /新規投稿/ }).click();
    await expect(page.locator('.form-table input[type="text"]').first()).toHaveValue('');
    await expect(page.locator('.form-table textarea[maxlength="100000"]')).toHaveValue('');
  });

  test('プレビュー→送信の2段階フロー', async ({ page }) => {
    await page.goto('/post');
    const inputs = page.locator('.form-table input[type="text"], .form-table textarea');
    await inputs.first().fill('E2Eテスト作品');
    await page.locator('.form-table textarea').fill('これはE2Eテストの本文です。');
    await page.getByRole('tab', { name: 'プレビュー' }).click();
    await expect(page.locator('body')).toContainText('E2Eテスト作品');
    await expect(page.getByRole('button', { name: '投稿する' })).toBeVisible();
  });

  test('投稿プレビューで字下げを確認でき、脚注は字下げされない', async ({ page }) => {
    await page.goto('/#post');
    await page.locator('.form-table input[type="text"]').first().fill('字下げ確認作品');
    await page.locator('.form-table textarea').fill('本文です。\n　　手動の間\n[^note]\n[^note]: 注釈本文です。');
    await page.getByRole('tab', { name: 'プレビュー' }).click();

    const authorIndentControl = page.locator('[data-testid="author-indent-mode-control"]:visible');
    await authorIndentControl.getByRole('radio', { name: '自動字下げあり' }).check();
    await expect(page.locator('.article-body')).toContainText('　本文です。');
    await expect(page.locator('.article-body')).toContainText('　　手動の間');
    await expect(page.locator('.footnote-list')).toContainText('注釈本文です。');
    const footnoteText = await page.locator('.footnote-list').innerText();
    expect(footnoteText).not.toContain('　注釈本文です。');
  });

  test('投稿プレビューで連続ダーシを原文のまま細い二倍ダーシとして組む', async ({ page }) => {
    await page.goto('/post');
    await page.locator('.form-table input[type="text"]').first().fill('ダーシ表示確認');
    await page.locator('.form-table textarea[maxlength="100000"]').fill('含んだ——その香り');
    await page.getByRole('tab', { name: 'プレビュー' }).click();

    const dashRun = page.locator('.article-body .novel-dash-run');
    await expect(dashRun).toHaveCount(1);
    await expect(dashRun).toHaveText('——');
    await expect(page.locator('.article-body')).toContainText('含んだ——その香り');

    const typography = await dashRun.evaluate(async (element) => {
      await document.fonts.ready;
      const style = getComputedStyle(element);
      const parentStyle = getComputedStyle(element.parentElement!);
      return {
        fontFamily: style.fontFamily,
        fontSize: Number.parseFloat(style.fontSize),
        parentFontSize: Number.parseFloat(parentStyle.fontSize),
        decoration: style.textDecorationLine,
        width: element.getBoundingClientRect().width,
        fontLoaded: document.fonts.check(`${style.fontSize} "Ari Novel Dash"`, '——'),
      };
    });
    expect(typography.fontFamily).toContain('Ari Novel Dash');
    expect(typography.fontLoaded).toBe(true);
    expect(typography.decoration).toBe('none');
    expect(typography.fontSize).toBe(typography.parentFontSize);
    expect(typography.width).toBeGreaterThanOrEqual(typography.fontSize * 1.99);
    expect(typography.width).toBeLessThanOrEqual(typography.fontSize * 2.01);
  });

  test('投稿者の字下げ意図が本文と分離して保存される', async ({ page }) => {
    await page.goto('/post');
    await page.locator('.form-table input[type="text"]').first().fill('投稿者設定保存テスト');
    await page.locator('.form-table textarea').fill('本文です。');
    await page.getByRole('tab', { name: 'プレビュー' }).click();

    const authorIndentControl = page.locator('[data-testid="author-indent-mode-control"]:visible');
    await authorIndentControl.getByRole('radio', { name: '自動字下げあり' }).check();
    page.on('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: '投稿する' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect.poll(async () => page.evaluate(() => {
      const raw = localStorage.getItem('bunsho_novels_v2');
      if (!raw) return null;
      const novels = JSON.parse(raw) as Array<{ title: string; authorIndentMode?: string }>;
      return novels.find((novel) => novel.title === '投稿者設定保存テスト')?.authorIndentMode ?? null;
    })).toBe('jisage');
  });
});

test.describe('アリの穴NEO - 作品閲覧', () => {
  test('作品切替時に前の作品内容が残らない', async ({ page }) => {
    await page.goto('/');
    const links = page.locator('.entry-title-link');
    if (await links.count() < 2) return;

    const title1 = (await links.nth(0).textContent())?.trim() ?? '';
    const title2 = (await links.nth(1).textContent())?.trim() ?? '';

    await links.nth(0).click();
    await expect(page.locator('.article-title')).toHaveText(title1);
    await page.locator('.back-link').first().click();
    await links.nth(1).click();
    await expect(page.locator('.article-title')).toHaveText(title2);
  });

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

  test('感想の採点は任意で、普通を選べる', async ({ page }) => {
    await page.goto('/');
    const firstLink = page.locator('.entry-title-link').first();
    await expect(firstLink).toBeVisible();
    await firstLink.click();
    const voteSelect = page.locator('.comment-form select');
    await expect(voteSelect).toHaveValue('none');
    await expect(voteSelect.locator('option[value="0"]')).toHaveText('普通');
    await expect(page.locator('.vote-note')).toContainText('ポイント集計には含まれません');
    await expect(page.locator('.comment-form input[type="text"]')).toHaveAttribute('placeholder', '名無し');
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

  test('しおりから断片読みを再開できる', async ({ page }) => {
    await page.goto('/');
    const firstLink = page.locator('.entry-title-link').first();
    await expect(firstLink).toBeVisible();
    await firstLink.click();
    await expect(page.locator('.article-body')).toBeVisible();
    await page.getByRole('button', { name: '断片読み', exact: true }).click();

    const fragmentBookmarks = page.locator('.reader-fragment-bookmark');
    await expect(fragmentBookmarks.nth(1)).toBeVisible();
    const fragmentIndex = await fragmentBookmarks.nth(1).getAttribute('data-fragment-index');
    if (!fragmentIndex) throw new Error('断片番号を取得できませんでした');

    await fragmentBookmarks.nth(1).click();
    const resumeName = new RegExp(`断片 ${fragmentIndex} のしおりから再開`);
    await expect(page.getByRole('button', { name: resumeName })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('button', { name: resumeName })).toBeVisible();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    await page.getByRole('button', { name: resumeName }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator(`#reader-fragment-${fragmentIndex}`)).toBeFocused();

    await page
      .getByRole('button', { name: new RegExp(`断片 ${fragmentIndex} のしおりを外す`) })
      .click();
    await expect(page.getByRole('button', { name: resumeName })).not.toBeVisible();
  });

  test('本文更新で無効になったしおりは誤移動しない', async ({ page }) => {
    await page.goto('/');
    const firstLink = page.locator('.entry-title-link').first();
    await expect(firstLink).toBeVisible();
    await firstLink.click();
    await expect(page.locator('.article-body')).toBeVisible();

    const novelId = new URL(page.url()).pathname.split('/').filter(Boolean).pop();
    if (!novelId) throw new Error('作品IDを取得できませんでした');

    await page.evaluate((id) => {
      localStorage.setItem('bunsho_reader_bookmarks_v1', JSON.stringify({
        [id]: {
          novelId: id,
          fragmentIndex: 999,
          savedAt: '2026-08-21T00:00:00.000Z',
        },
      }));
    }, novelId);
    await page.reload();

    const resumeButton = page.getByRole('button', { name: '断片 999 のしおりから再開' });
    await expect(resumeButton).toBeVisible();
    await resumeButton.click();

    await expect(page.locator('.reader-bookmark-status')).toContainText('本文が更新された可能性があります');
    await expect(page.locator('#reader-fragment-999')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '断片読み', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });

  test('読者は自動字下げを切り替えられ、設定が保持される', async ({ page }) => {
    await page.goto('/#read/1');
    const articleBody = page.locator('.article-body');
    const noIndentText = await articleBody.innerText();

    await expect(page.getByRole('button', { name: '>>字下げ設定' })).toBeVisible();
    await page.getByRole('button', { name: '>>字下げ設定' }).click();
    const settingsDialog = page.getByRole('dialog', { name: '設定 / ヘルプ' });
    await expect(settingsDialog).toBeVisible();
    await settingsDialog.getByRole('button', { name: '閉', exact: true }).click();

    await expect(page.getByRole('radio', { name: '投稿者設定に従う' })).toBeChecked();
    await page.getByRole('radio', { name: '自動字下げあり' }).check();
    await expect(articleBody).toContainText('　これは');
    expect(noIndentText).not.toContain('　これは');

    await page.getByRole('radio', { name: '投稿者設定に従う' }).check();
    const authorModeText = await articleBody.innerText();
    expect(authorModeText).not.toContain('　これは');

    await page.getByRole('radio', { name: '自動字下げあり' }).check();
    await page.reload();
    await expect(page.getByRole('radio', { name: '自動字下げあり' })).toBeChecked();
  });
});

test.describe('アリの穴NEO - 管理画面', () => {
  test('管理画面にログインフォームが表示される', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('body')).toContainText('管理者ログイン');
  });
});
