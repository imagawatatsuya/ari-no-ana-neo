# 文章アリの穴NEO

2000年代中盤のテキストサイト・投稿サイトの懐かしい雰囲気を再現したReactアプリケーション。

🔗 **Live Demo:** https://ari.denmei.org/

## 概要

このプロジェクトは、かつてのインターネット文化の象徴であったテキストサイトや投稿サイトの風情をモダンなWeb技術で蘇らせたものです。Supabaseをバックエンドとして利用し、投稿・感想の保存と取得を行います。

## 主な機能

- **5段階評価** — 感想に「とても良い / 良い / 普通 / 良くない / 最悪」を付けられる。採点しない票はポイントの合計・平均・投票数に含めない
- **2段階投稿** — 入力 → プレビュー確認 → 送信のフロー（原稿用紙換算枚数表示付き）
- **脚注レンダラー** — 本文内のURL自動リンク化 + 脚注構文のポップアップ表示
- **字下げ設定** — 投稿者の意図（自動字下げなし / 自動字下げあり）と、読者の表示設定（なし / 自動 / 投稿者設定）を分離して管理。未設定の読者は投稿者設定に従い、保存済みの読者設定は維持する。表示用コピーでは一字の標準字下げマーカーを読者設定に応じて整理し、二字以上の手動空白は保持
- **サーバーサイドページング** — Supabaseモードでは20件/页のサーバー側ページング
- **作品検索** — タイトル・作者を検索（オンラインはDB側、オフラインは端末内）
- **分割読み・しおり** — 作品を短い断片に分けて読み、作品ごとに続きから再開
- **オフラインフォールバック** — Supabase未設定時は localStorage + シードデータで動作
- **管理ダッシュボード** — Supabase Auth ログイン + RLS で編集 / 削除 / 非表示を制御
  - 作品の編集・削除
  - 非表示/公開トグル（Supabase `is_hidden` 列と同期）
  - 一括非表示/公開（チェックボックス選択）
  - フィルタタブ（全て / 公開中 / 非表示）
- **日本語組版** — ezdog由来のCSS組版（禁則処理・ぶら下げ・両端揃え）
- **モバイルレスポンシブ** — iPhone 8相当の画面幅に対応
- **連投制限** — UIとDBで60秒クールダウン。オンラインは接続元・投稿種別ごとに判定
- **公開制御と再取得** — 非表示作品と感想はRLSで一般閲覧を拒否。読書キャッシュは30秒で失効し、再訪・画面復帰・表示中の30秒間隔で最新データを確認
- **閲覧数カウント** — Supabase RPC（`increment_novel_view`）で安全に加算

> ✅ 推奨構成: 管理認証は Supabase Auth、更新・削除権限は RLS（`admin_users` テーブル）で制御します。

## 技術スタック

- **Frontend:** React 18 + TypeScript 5.5
- **Backend:** Supabase (PostgreSQL + Auth + RLS)
- **Deployment:** GitHub Pages (GitHub Actions)
- **Build Tool:** Vite 7.3 / Node.js 22.12以上（CIは22系）
- **Routing:** History APIベースのクライアントルーティング（`/`、`/read/:id`、`/ryuseigai`、`/ryuseigai/read/:id`、`/post`、`/admin`、`/page/:n`）。旧hash形式（`#read/:id`、`#post`、`#admin`、`#page/:n` など）はHistory API URLへ互換変換します。

## インストール・セットアップ

### 1. リポジトリをクローン

```bash
git clone https://github.com/imagawatatsuya/ari-no-ana-neo.git
cd ari-no-ana-neo
```

### 2. 依存パッケージのインストール

```bash
npm ci
```

### 3. 環境変数を設定

プロジェクトルートに `.env.local` ファイルを作成し、以下の内容を記述してください：

```bash
cp .env.example .env.local
```

```env
# Supabase Configuration (SupabaseのProject Settingsから取得)
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# 任意: Supabase未使用のローカル運用でのみ管理画面PWを使う場合
# VITE_ADMIN_PASSWORD=your_local_admin_password
```

### 4. Supabaseの初期設定

1. [Supabase](https://supabase.com/) で新しいプロジェクトを作成
2. `supabase_schema_v2.sql` の内容をコピー
3. Supabaseの SQL Editor で実行してテーブル / RLS / policy / RPC を作成
   - 新規DBは続けて `supabase/migrations/20260730_list_public_novels.sql` を適用します
   - 既存DBは [マイグレーション手順](docs/SUPABASE_MIGRATIONS.md) に従い、未適用分だけ適用してください
4. Supabase Auth で管理者ユーザーを作成（Email+Password）
5. 作成したユーザーID（auth.users.id）を `admin_users` に登録

### 5. ローカル開発サーバーを起動

```bash
npm run dev
```

ブラウザで http://localhost:5173 にアクセスして実行を確認できます。

## デプロイ

このプロジェクトはGitHub Actionsを使用してGitHub Pagesへ自動デプロイされます。PR時とデプロイ前にLinux / Windowsの単体・DBテスト、ビルド、Chromium / WebKitのE2Eと依存監査を実行し、失敗時はデプロイしません。

```bash
npm test
npm run build
npx playwright install chromium webkit
npm run test:e2e
npm audit --audit-level=moderate
```

DBテストはPGlite内のPostgreSQLでRLS・トリガー・既存DB移行を検証します。E2Eは専用のビルド出力 `.e2e/` とポート5179 / 5180を使用し、Supabase未接続のローカル動作とモックAPIを使うオンライン動作を検証します。本番DBへの接続や投稿は行いません。E2E用管理パスワードはテスト用ビルドにだけ渡し、公開用の `dist/` には含めません。

マージの必須チェック設定と障害時の復旧は [運用手順](docs/OPERATIONS.md) を参照してください。

Viteのビルドは独自ドメインのroot deployment向けに絶対アセットパス（`base: '/'`）を使います。`router.ts` はViteのbase、生成されたasset path、現在のpathnameからproject pathを検出し、History APIのURLに適用します。GitHub Pagesのdeep linkは `public/404.html` が一時保存してアプリへ引き渡します。

正式URL、canonical、OG URL、sitemap、robotsのSitemap URLは `https://ari.denmei.org/` に統一しています。GitHub PagesのCustom domain設定とDNSはこのドメインを指すように構成します。

### デプロイ設定

`.github/workflows/deploy.yml` に設定が含まれています。

### 環境変数の登録

GitHub上でデプロイするには、以下の手順で環境変数を登録してください：

1. リポジトリの **Settings** にアクセス
2. **Secrets and variables > Actions** を選択
3. 以下の変数を新規作成：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

## セキュリティに関する注意

このリポジトリにはAPIキーなどの機密情報は含まれていません。必ず環境変数を通じて設定してください。本番環境ではSupabaseの行レベルセキュリティ（RLS）の設定を確認してください。

## 参考

このプロジェクトのインスピレーション元となった「2ch文章アリの穴」は、以下のアーカイブで確認できます：

🔗 [Web Archive - アリの穴](https://web.archive.org/web/20130729143317/http://ana.vis.ne.jp/ali/)

## ライセンス

詳細はリポジトリを参照してください。

## 今後の予定

- [ ] Supabase無料枠の7日停止対策（定期アクセス or 有料プラン移行）
- [ ] 他の機能拡張

---

**最終更新:** 2026年10月22日
