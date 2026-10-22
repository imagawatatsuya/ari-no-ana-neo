# Supabase マイグレーション

本番 DB に SQL マイグレーションを適用する手順。

## 適用順序と適用履歴

新規DBは `supabase_schema_v2.sql`（最新の公開制御を含む）と `20260730_list_public_novels.sql` を実行する。既存DBでは列・RPCを確認し、次の未適用分だけを順に適用する。

1. `20260730_list_public_novels.sql`
2. `20260812_author_indent_mode.sql`
3. `20260813_author_message.sql`
4. `20260821_comment_vote_nullable.sql`
5. `20261022_public_access_hardening.sql`

**`20260821_comment_vote_nullable.sql` はデータ変換を伴う一度限りの移行。** 既存の0点を未採点へ変換するため、適用済みDBや新規DBでは再実行しない。適用済みか不明な場合は `comments.vote` のNOT NULL、`list_public_novels` の `vote_count` 戻り値、過去の適用記録を確認し、不明のまま実行しない。

本番適用前にバックアップを取り、ステージングで `npm test` と下記の確認SQLを実行する。20261022以降の適用履歴は `private.app_migrations` に記録される。旧移行の履歴は自動補完されない。

## 公開範囲・投稿制約（必須）

`supabase/migrations/20261022_public_access_hardening.sql` をSQL Editorで実行する。トランザクション単位で反映され、再実行しても本文・採点の変換はしない。

- 匿名・一般ユーザーは非表示作品とその感想をSELECTできず、非表示作品に投稿もできない。
- `admin_users` 登録済みの管理者は非表示作品・感想も読める。ログインしただけの一般ユーザーには管理権限を付与しない。
- 直接API投稿にも60秒制限・投稿先に応じた採点値チェック・サーバー時刻が適用される。
- 閲覧数RPCは非表示作品を更新しない。

適用後、`supabase/verify-hardening.sql` をSQL Editorで実行し、適用履歴・restrictiveな表示ポリシー・トリガー、匿名からの非表示件数0と非公開テーブルへの権限falseを確認する。管理者・一般ユーザーと直接APIによる確認はステージングの専用作品で行う。ローカルDBテストは新規構築と既存スキーマへの移行の両方でこれらを検証する。

プロキシの信頼境界、共有回線の制限、障害時の投稿停止・復旧は [運用手順](OPERATIONS.md) を参照。

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

## 未採点とポイント集計（必須）

ファイル: `supabase/migrations/20260821_comment_vote_nullable.sql`

感想の「採点しない」を `vote = null` として保存し、ポイントの合計・平均・投票数から除外する。旧UIでは「採点しない」が `0` だったため、既存の `vote = 0` は null へ移行する。あわせて `list_public_novels` が `vote_count`（採点した票数）を返すように更新する。

新規の未採点感想をオンラインで受け付ける前に適用する。未適用の場合、未採点の insert は RLS / NOT NULL で失敗する。
