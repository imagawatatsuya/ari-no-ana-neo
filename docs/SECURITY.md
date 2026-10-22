# セキュリティ設定と確認

## 本番DB

2026-10-22に、変更対象の `novels` 199件、`comments` 114件、`admin_users` 1件と列・制約・ポリシー・関数・権限をアプリ単位でバックアップした。Authサービス全体・Storage・システム設定を含むDB全体のバックアップではない。データはリポジトリ外のローカル保存先で管理し、本文・認証情報をGitやCI成果物に含めない。

バックアップは隔離したPGliteで復元し、全行を比較した。復元データに両セキュリティマイグレーションを適用後も全行が一致することを確認した。復元検証は `node scripts/verify-app-backup.mjs <app-backup.json>` で再実行できる。本番への自動復元・既存データの削除は行わない。

`20261022_public_access_hardening.sql` 適用後、匿名からの非表示作品件数は182件から0件となった。匿名更新・削除は不存在IDを対象とするAPI要求で拒否を確認した。管理者と一般ユーザーの閲覧権限、サーバー時刻、作品・感想の連続投稿制限、不正採点・未採点の扱いは本番DB内の専用データとロールで検証し、すべてロールバックした。

Supabaseの実際のAPI入口に偽の `X-Forwarded-For` を送った検証では、末尾が偽装値とは異なり、公開IPで、`CF-Connecting-IP` と一致した。この環境では末尾を使う投稿制限が偽装プレフィックスの影響を受けない。一時的な検証関数は削除済み。プロキシ経路を変更したら再確認する。

## DB設定の変更検知

`20261022_security_attestation.sql` は、RLS、テーブルACL、ポリシー、制約、トリガーの有効状態、保護用関数の定義・ACL、privateスキーマのACLを指紋化し、非公開の基準テーブルに保存する。公開RPC `security_health()` は適用履歴と現在の指紋が一致する場合だけbooleanのtrueを返す。作品データ、管理者ID、ポリシーや指紋の内容を公開しない。

デプロイは疎通確認後に `node scripts/check-security.mjs` を実行する。RPC未適用、ネットワーク障害、応答不正、基準との差異では失敗して公開を止める。公開キーだけを使い、秘密キーをフロントエンドへ渡さない。

基準は再実行で上書きしない。意図したスキーマ変更でも不一致になるため、変更内容をレビュー・検証したマイグレーションで基準を更新する。警告を消す目的で基準を削除・再作成しない。この検査はDB所有者による悪意ある改変への独立した防御ではなく、設定漏れや設定変更の検出である。

## ブラウザと配信

ViteがHTML先頭にCSPを挿入する。製品ビルドのスクリプトは同一オリジンだけ、API通信はビルド時に指定したSupabaseオリジンだけを許可する。インラインスクリプト、eval、object、外部フレーム、フォームのブラウザ直接送信は許可しない。Reactの位置指定に必要なインラインstyleは許可する。フォントは独立ファイルとして配信し、dataフォントを許可しない。

`frame-ancestors` はmetaでは機能しないため、配信側のHTTPヘッダーで設定する。既存Cloudflareゾーンの対象ホストだけにResponse Header Transform Ruleを適用する定義は `deploy/cloudflare-response-headers.json`。ヘッダーのCSPは `frame-ancestors 'none'` のみで、HTMLのCSPと同時に適用される。X-Frame-Options、nosniff、Referrer-Policy、Permissions-Policyも設定する。

Cloudflareのプロキシが無効なDNSレコードではTransform Ruleは反映されない。プロキシ化する場合は既存の証明書・SSLモード・他のルールを先に確認し、ホストを `ari.denmei.org` に限定する。TLS検証を弱めず、他ホストのルールやキャッシュ設定を変更しない。新規契約や有料プランが必要なら先に構成と料金を提示する。

2026-10-22、既存Freeプランの設定枠内で両ルールを有効化し、ariのCNAMEのみプロキシ化した。ゾーン全体のFlexible設定には触れず、`deploy/cloudflare-tls-rule.json` のホスト限定Strict設定を先に適用した。既存のUniversal証明書が有効であることを確認し、切替後もHTTPS 200と5つの保護ヘッダーを確認した。CNAMEの宛先は `imagawatatsuya.github.io`。DNS onlyへ戻すとHTTPヘッダーの保護が失われるため、障害時にもこの点を確認する。

同じホスト限定ルールでRUMを抑止し、プロキシ化に伴うCloudflare解析スクリプトの新規挿入を止めた。CSPのスクリプト許可先を増やさずに配信する。

公開後はHTTPSでレスポンスヘッダー、トップ・作品の直接URL、管理ログイン・投稿・フォントを確認する。CSPのインライン実行と未許可接続の遮断はChromium/WebKitのE2Eで検証する。

参考: [Supabase APIの保護](https://supabase.com/docs/guides/api/securing-your-api)、[Cloudflare Response Header Transform Rules](https://developers.cloudflare.com/rules/transform/response-header-modification/)。
