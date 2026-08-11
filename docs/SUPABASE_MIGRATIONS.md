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

## 注意

- マイグレーションは **本番 Supabase プロジェクト** に対して実行する
- `novels.date` が text 型でも動作するよう `::timestamptz` キャストを使っている
- ローカル開発（オフラインモード）では Supabase 不要
