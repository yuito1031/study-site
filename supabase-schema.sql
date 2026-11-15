-- Run this once in Supabase Dashboard → SQL Editor.
-- Each authenticated user can read and modify only their own study profile.
create table if not exists public.study_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '学習者',
  tasks jsonb not null default '[]'::jsonb,
  total_study_time integer not null default 0 check (total_study_time >= 0),
  pomodoro_count integer not null default 0 check (pomodoro_count >= 0),
  streak_count integer not null default 0 check (streak_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.study_profiles enable row level security;
alter table public.study_profiles force row level security;

drop policy if exists "Users can read their own study profile" on public.study_profiles;
create policy "Users can read their own study profile"
  on public.study_profiles for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own study profile" on public.study_profiles;
create policy "Users can create their own study profile"
  on public.study_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own study profile" on public.study_profiles;
create policy "Users can update their own study profile"
  on public.study_profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.study_profiles to authenticated;
