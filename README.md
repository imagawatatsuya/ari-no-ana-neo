# 文章アリの穴NEO

2000年代中盤のテキストサイト・投稿サイトの懐かしい雰囲気を再現したReactアプリケーション。

🔗 **Live Demo:** https://imagawatatsuya.github.io/ari-no-ana-neo/

## 概要

このプロジェクトは、かつてのインターネット文化の象徴であったテキストサイトや投稿サイトの風情をモダンなWeb技術で蘇らせたものです。Supabaseをバックエンドとして利用し、リアルタイムでのデータ連携を実現しています。

## 主な機能

- **トリップ機能** — パスワードから個人識別記号列を生成し、ユーザーを識別
- **評価機能** — 投稿に対して5段階評価を付与
- **Supabaseバックエンド連携** — クラウドベースのデータベース管理
- **管理ダッシュボード** — Supabase Auth ログイン + RLS で編集 / 削除 / 非表示を制御

> ✅ 推奨構成: 管理認証は Supabase Auth、更新・削除権限は RLS（`admin_users` テーブル）で制御します。

## 技術スタック

- **Frontend:** React
- **Backend:** Supabase
- **Deployment:** GitHub Pages (GitHub Actions)
- **Build Tool:** Vite

## インストール・セットアップ

### 1. リポジトリをクローン

```bash
git clone https://github.com/imagawatatsuya/ari-no-ana-neo.git
cd ari-no-ana-neo
```

### 2. 依存パッケージのインストール

```bash
npm install
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
4. Supabase Auth で管理者ユーザーを作成（Email+Password）
5. 作成したユーザーID（auth.users.id）を `admin_users` に登録

### 5. ローカル開発サーバーを起動

```bash
npm run dev
```

ブラウザで http://localhost:5173 にアクセスして実行を確認できます。

## デプロイ

このプロジェクトはGitHub Actionsを使用してGitHub Pagesへ自動デプロイされます。

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

- [ ] 削除機能／編集機能の実装
- 他の機能拡張

---

**最終更新:** 2025年11月
