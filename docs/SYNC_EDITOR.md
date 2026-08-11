# エディタ同期（ari-no-ana-neo → ari-preview-editor）

本番リポジトリ [ari-no-ana-neo](https://github.com/imagawatatsuya/ari-no-ana-neo) を**正**とし、執筆用ツール [ari-preview-editor](https://github.com/imagawatatsuya/ari-preview-editor) へレンダリング部分を自動同期する。

## 同期されるファイル

| 本番（正） | 執筆ツール（自動更新） |
|---|---|
| `components/FootnoteRenderer.tsx` | `components/FootnoteRenderer.tsx` |
| `styles/footnote-renderer.css` | `styles/footnote-renderer.css` |

**同期されないもの**（執筆ツール側で自由に編集してよい）:

- `app/page.tsx`（左右分割プレビュー UI）
- Tailwind / Next.js の設定

## 初回セットアップ

### 1. preview-editor 側の準備（一度だけ）

```powershell
pwsh scripts/bootstrap-preview-editor.ps1
```

`globals.css` を同期用に書き換え、初回ファイルを `ari-preview-editor` に push する。

### 2. Personal Access Token（PAT）の作成

1. [Fine-grained tokens（新規作成）](https://github.com/settings/personal-access-tokens/new) を開く
2. **Generate new token** をクリック
3. 次のように設定する:

| 項目 | 設定 |
|---|---|
| Token name | 例: `neo-to-preview-editor-sync` |
| Expiration | 任意（90日・1年など） |
| Repository access | **Only select repositories** → `ari-preview-editor` を選択 |
| Permissions → Repository permissions | **Contents: Read and write** |

4. **Generate token** を押す
5. 表示された `github_pat_xxxx...` の文字列をコピーする

> PAT は作成直後に一度だけ表示される。再表示できないので、この時点で必ずコピーすること。

### 3. GitHub Secret の登録

**登録先は `ari-no-ana-neo` リポジトリ**（preview-editor ではない）。

1. `ari-no-ana-neo` → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret** をクリック
3. 次を入力する:

| 項目 | 値 |
|---|---|
| Name | `PREVIEW_EDITOR_SYNC_TOKEN` |
| Secret | 手順 2 でコピーした PAT |

4. **Add secret** をクリック

## 動作確認

1. `components/FootnoteRenderer.tsx` または `styles/footnote-renderer.css` を編集して `main` に push
2. `ari-no-ana-neo` の **Actions** タブで `Sync editor to preview-editor` が成功することを確認
3. `ari-preview-editor` に `sync: update editor from ari-no-ana-neo@...` のコミットが入ることを確認

手動実行する場合: Actions → **Sync editor to preview-editor** → **Run workflow**

## 日常の運用

```
ari-no-ana-neo でエディタを編集
  → main に push
  → 数秒後に ari-preview-editor が自動更新
```

執筆ツールの UI を変えたいときは `ari-preview-editor` を直接編集する。本番側には影響しない。

## トラブルシューティング

### workflow が失敗する（checkout / push エラー）

- `PREVIEW_EDITOR_SYNC_TOKEN` が `ari-no-ana-neo` に登録されているか確認
- PAT の有効期限が切れていないか確認
- PAT が `ari-preview-editor` への **Contents: Read and write** を持っているか確認

### PAT を漏らした・期限切れになった

1. [Fine-grained tokens](https://github.com/settings/personal-access-tokens) で古い PAT を **Revoke**
2. 新しい PAT を作成
3. `ari-no-ana-neo` の Secret `PREVIEW_EDITOR_SYNC_TOKEN` を更新（**Update**）

### preview-editor の見た目がずれる

`styles/footnote-renderer.css` は本番側で編集し、push して同期する。preview-editor 側の `styles/footnote-renderer.css` は**手動編集しない**（次回 sync で上書きされる）。
