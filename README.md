# My Hub

ログインした人が自分の情報をまとめて管理できる、個人向け総合サイトです。タスク��メモ、習慣、予定の機能を用意しています。

## 機能
- Supabase Auth のメール・パスワード認証
- Supabase PostgreSQL にユーザーごとのデータを保存（RLSで保護）
- タスク管理、メモ、習慣トラッカー、予定一覧
- スマートフォンにも対応したダッシュボード

## Supabaseの初期設定
1. `supabase-schema.sql` をSupabase SQL Editorで実行済みであることを確認します。
2. 次に `supabase-workspace-migration.sql` の内容をSQL Editorで実行し、総合サイト用データ領域を追加してください。
3. Authentication → URL Configuration で Site URL を `https://yuito1031.github.io`、Redirect URL に `https://yuito1031.github.io/study-site/` を設定します。
4. Authentication → Providers → Email でメール認証を設定します。
5. GitHub Pagesのデプロイ後、サイトで新規登録またはログインします。

## キーについて
`supabase-config.js` にはブラウザー用の公開可能キーのみを設定します。`sb_secret_` や `service_role` の秘密鍵は絶対にコミットしないでください。公開可能キーを含むフロントエンドのコードは公開される前提です。アクセス制御はSupabase AuthとRLSで行います。
