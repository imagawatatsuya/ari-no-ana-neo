# Supabase マイグレーション

本番 DB に SQL マイグレーションを適用する手順。

## 一覧取得 RPC（必須）

ファイル: `supabase/migrations/20260730_list_public_novels.sql`

作品一覧を1クエリで取得する `list_public_novels` 関数とインデックスを追加する。未適用の場合、アプリは自動的にフォールバッククエリ（複数回の DB アクセス）を使う。

### 適用手順

1. [Supabase Dashboard](https://supabase.com/dashboard) → プロジェクトを開く
2. **SQL Editor** → **New query**
3. `supabase/migrations/20260730_list_public_novels.sql` の内容を貼り付けて **Run**

### 適用確認

SQL Editor で次を実行する:

```sql
select public.list_public_novels(0, 5, null, false);
```

- エラーなく行が返れば OK
- `Could not find the function` と出る場合は未適用

### アプリ側の挙動

| 状態 | 挙動 |
|---|---|
| RPC あり | `list_public_novels` を1回呼ぶ（高速） |
| RPC なし | novels + comments を別々に取得（フォールバック） |

フォールバックでも動作はするが、作品数が増えると一覧表示が遅くなる。

## 投稿者字下げ意図（必須）

ファイル: `supabase/migrations/20260812_author_indent_mode.sql`

`novels.author_indent_mode` 列を追加する。既存投稿は `raw`（原文どおり）として扱い、本文は変更しない。新規投稿をSupabaseモードで受け付ける前に適用する。未適用の旧DBでも投稿は互換リトライで継続できるが、`jisage` の投稿者設定は保存されず、画面に警告が出る。

```sql
select column_name, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'novels'
  and column_name = 'author_indent_mode';
```

`column_default` が `'raw'::text` などになっていれば適用済み。

## 注意

- マイグレーションは **本番 Supabase プロジェクト** に対して実行する
- `novels.date` が text 型でも動作するよう `::timestamptz` キャストを使っている

## 作者からのメッセージ列

ファイル: `supabase/migrations/20260813_author_message.sql`

作品ページ下部の「作者からのメッセージ」を、副題（既存の `description` 列）や作者名とは別に保存するための `novels.author_message` 列を追加する。既存作品の `description` は副題として保持し、作者名を作者メッセージへ移行しない。

新規投稿・管理画面編集をオンラインモードで使う前に、本番Supabaseプロジェクトへ適用する。
- ローカル開発（オフラインモード）では Supabase 不要
