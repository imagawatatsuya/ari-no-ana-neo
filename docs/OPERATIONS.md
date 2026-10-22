# 検証・リリース・復旧

## リリース前

1. Node.js 22.12以上で `npm ci`。`npm test`、`npm run build`、`npm run test:e2e`、`npm audit --audit-level=moderate` を通す。ブラウザ未導入時は `npx playwright install chromium webkit`。
2. DBは本番相当のステージングで [移行手順](SUPABASE_MIGRATIONS.md) と適用確認SQLを実行する。本番適用前にDBバックアップと取得時刻を記録する。
3. PRのCIで Linux / Windows の検証を確認してからマージする。`deploy.yml` は同じCIを再利用し、成功した場合のみPagesへデプロイする。
   デプロイ前には公開キーを使って実際の一覧RPCを1件だけ読み取る。DNS・接続・認証・RPCのいずれかが失敗した場合もデプロイを止める。作品投稿や閲覧数加算は行わない。
4. 公開後にトップ、作品URLへの直接アクセス、通常投稿・未採点感想、管理ログイン、非表示作品の匿名アクセス拒否を確認する。投稿確認には専用テスト作品を用意し、実データを上書きしない。

## GitHubのマージ制御

リポジトリの Settings → Rules → Rulesets で `main` を対象に、PR必須・必須ステータスチェックを設定する。最初のPRでCIを実行後、`Validate (ubuntu-latest)` と `Validate (windows-latest)` を実際のチェック一覧から選ぶ。チェック名はActions画面で確認する。ワークフローファイルだけではリポジトリのマージ制限は設定されない。

## DB移行と制約

- 新しい公開制御は **DBマイグレーション適用後** に有効になる。アプリのデプロイだけではRLSは変わらない。
- 接続元はAPIの信頼されたリバースプロキシが `X-Forwarded-For` に追加した末尾のIPを使う。自前ホスティングや追加プロキシでは、末尾が利用者IPであり外部から任意指定できないことを確認する。内部プロキシIPが末尾なら、その構成に合わせて信頼境界を変更してから適用する。
- 接続元IPのSHA-256ハッシュ・投稿種別・最終投稿時刻だけを非公開テーブルに保持する。成功した投稿時に1日超の記録を削除するため、無投稿期間は期限超の記録が残る。生のIPは保存しないが、ハッシュも接続元情報として管理する。
- 同じIP（共有回線を含む）は作品投稿・感想投稿それぞれ60秒で1件。プロキシ情報なしは認証ユーザー単位、匿名は共通バケットで制限する。ブラウザの保存領域を消してもDB制限は解除されない。
- `service_role` とSQL管理操作は頻度制限を受けない。キーをブラウザや公開リポジトリに配置しない。
- 通常作品は `null, -2, -1, 0, 1, 2`、流星垓は `null, -500, -1000` の新規採点を許可する。作品の流星垓移動時は過去の票を保持し、新規・変更された採点だけ投稿先に合わせる。

## 障害時

`TypeError: Failed to fetch` や `ERR_NAME_NOT_RESOLVED` の場合は、まずSupabase Dashboardのプロジェクト状態とURLのDNSを確認する。無料プロジェクトが停止中ならResumeし、DNSとAPIの復旧を待つ。再開後は本番ページを再読み込みし、「前回取得した一覧」の表示が消えて最新一覧が表示されることを確認する。接続先をダミーデータに切り替えて復旧扱いにしない。

ローカルでも、URLと公開APIキーを環境変数に設定して `node scripts/check-supabase.mjs` を実行できる。`.env.local` に設定済みなら `node --env-file=.env.local scripts/check-supabase.mjs`。キーの値をログやコミットに含めない。

1. GitHub Actionsの失敗ログと添付された `test-results` を確認する。CI失敗時はデプロイされない。
2. フロントエンドの不具合は原因コミットをrevertしたPRで戻し、CI経由で再デプロイする。古いHTMLだけを手動コピーしない。
3. DBの投稿制限に不具合がある場合、まずSQL Editorで `revoke insert on public.novels, public.comments from anon, authenticated;` を実行して投稿を停止する。SELECTの公開制御は維持したまま原因を修正し、ステージングのDBテスト後に `grant insert on public.novels, public.comments to anon, authenticated;` で再開する。停止中はアプリに投稿失敗が表示される。
4. 非表示作品を公開する旧RLSへ戻さない。破壊的なデータ復旧が必要な場合は対象・バックアップ時刻・影響範囲を確認してから別途実施する。

## 根拠資料

- [Supabase: APIの保護と接続元IP](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase: RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: NXDOMAINの原因と停止プロジェクトの確認](https://supabase.com/docs/guides/troubleshooting/nxdomain-error-connecting-to-a-supabase-project)
- [Vite 7移行とNode.js要件](https://v7.vite.dev/guide/migration)
