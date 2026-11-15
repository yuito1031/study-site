-- Add the general-purpose personal workspace data used by My Hub.
-- Run in Supabase SQL Editor after the original supabase-schema.sql.
alter table public.study_profiles
  add column if not exists workspace jsonb not null default '{"tasks": [], "notes": [], "habits": [], "events": []}'::jsonb;

-- Keep row-level security enabled. Existing policies limit each account to its own profile row.
