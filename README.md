# StudyFlow

個人ごとの学習データをクラウドに保存する、Supabase Auth 対応の学習ダッシュボードです。

## 機能
- Supabase Auth のメール/パスワード認証（新規登録・ログイン・ログアウト）
- Supabase PostgreSQL へのタスク、学習時間、ポモドーロ記録の保存
- Row Level Security (RLS) でユーザーごとのプロフィール行を分離
- 25分集中タイマー、To-do、科目別進捗表示

## Supabase 接続手順
1. [Supabase](https://supabase.com) でプロジェクトを作成します。
2. Supabase Dashboard → **SQL Editor** で `supabase-schema.sql` の内容を実行します。
3. Dashboard → **Project Settings → API** から Project URL と publishable key（旧 anon key）をコピーします。`service_role` / secret key は絶対に使わないで��ださい。
4. リポジトリの `supabase-config.js` を編集し、プレースホルダーを自分の Project URL と publishable/anon key に置き換えて `main` にコミットします。ブラウザー用の publishable/anon key は公開される前提の値ですが、RLS は必須です。
5. Authentication → URL Configuration で Site URL に `https://yuito1031.github.io` を設定し、Redirect URLs に `https://yuito1031.github.io/study-site/` を追加します。
6. Authentication → Providers → Email でメール認証を有効にします。確認メールを使う場合は、メール内のリンクからサイトに戻れるよう URL 設定を確認してください。
7. GitHub Pages が最新コミットをデプロイしたら、サイトで新規登録・ログインを確認します。新規登録で確認メールが有効な場合、メール確認後にログインしてください。

## パスワードやキーについて
- Supabase の secret/service_role key を `supabase-config.js`、HTML、JavaScript、GitHub に置かないでください。
- GitHub Pages は静的ホスティングです。ブラウザーに置く設定値は利用者から見えます。アクセス制御は Supabase Auth と RLS で行います。
- 以前のデモ版で登録したローカルアカウント�� Supabase アカウントに移行されません。Supabase で新規登録してください。
- 本番運用前に Supabase のメール送信設定、利用制限、バックアップ、プライバシー告知を確認してください。

## ローカル確認
`index.html` をブラウザーで開くか、GitHub Pages で公開した URL を開きます。Supabase の設定を入れるまでは認証を有効にせず、ログイン情報も受け取りません。
