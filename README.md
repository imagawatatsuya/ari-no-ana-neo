# アリの穴NEO
2000年代中盤のテキストサイト・投稿サイトの雰囲気を再現したReactアプリケーションです。  
Supabaseによるバックエンド連携機能を搭載しています。  

## デモサイト
🔗 https\://imagawatatsuya.github.io/ari-no-ana-neo/  
削除機能は未実装　※2025年11月22日現在  

## 本家 2ch文章アリの穴（`http://ana.vis.ne.jp/ali/`）跡地  
🔗 https://web.archive.org/web/20130729143317/http://ana.vis.ne.jp/ali/  

## 機能
- トリップ機能（パスワードによる個人識別記号列を表示できる）  
- 評価機能（5段階評価）  

## セットアップ手順 (How to Setup)

このリポジトリにはAPIキーなどの機密情報は含まれていません。
ローカルで実行するには、以下の手順で環境変数を設定してください。

### 1. 依存関係のインストール
```bash
npm install
```

### 2. 環境変数の設定
プロジェクトルートに `.env.local` ファイルを作成し、以下の内容を記述してください。

```ini
# Supabase Configuration (データベース接続用)
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. データベースの準備 (Supabaseを使用する場合)
1. Supabaseで新しいプロジェクトを作成します。
2. `supabase_schema.sql` の内容をコピーし、Supabaseの SQL Editor で実行してテーブルを作成してください。

### 4. 開発サーバーの起動
```bash
npm run dev
```

## デプロイ

GitHub Actionsを使用してGitHub Pagesへデプロイする設定が含まれています (`.github/workflows/deploy.yml`)。
GitHubのリポジトリ設定 (Settings > Secrets and variables > Actions) に上記の環境変数を登録する必要があります。
