# StudyFlow

StudyFlow は、学習の習慣化を支えるためのシンプルな学習管理サイトです。

## できること
- 25分集中タイマー
- To-do 管理
- 科目ごとの進捗表示
- アカウントごとの個人データ管理
- GitHub Pages にそのまま公開可能

## 使い方
1. `index.html` をブラウザーで開く
2. 新規登録またはログイン
3. タスクを追加して学習を開始

## 本格ログイン対応の方法
今の実装は、Supabase を使った本格ログインに対応する準備を入れています。

### 1. Supabase を作成する
- https://supabase.com にアクセス
- 新規プロジェクトを作成
- SQL Editor で次のテーブルを作成

```sql
create table public.study_profiles (
  user_id uuid primary key,
  email text not null,
  name text not null,
  tasks jsonb not null default '[]'::jsonb,
  total_study_time integer not null default 0,
  pomodoro_count integer not null default 0,
  streak_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.study_profiles enable row level security;
```

### 2. `script.js` の設定を変更する
`script.js` の先頭にある次の値を自分の Supabase の値に置き換えます。

```js
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

### 3. そのまま GitHub Pages へ公開
- GitHub リポジトリで Settings → Pages を開く
- Branch: `main`
- Folder: `/ (root)`
- Save

## 注意事項
- このデモはブラウザー内の localStorage を使うこともできます。
- 本番運用の本格認証では、Supabase Auth と RLS を使うのが安全です。
- GitHub Pages は静的サイトのみです。データベースや本格ログインはバックエンドサービスが必要です。

## ライセンス
MIT
