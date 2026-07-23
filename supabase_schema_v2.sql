-- Supabase schema for 文章アリの穴NEO
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.novels (
  id text primary key,
  title text not null,
  description text,
  author text not null,
  trip text,
  body text not null,
  date timestamptz not null default now(),
  view_count integer not null default 0 check (view_count >= 0),
  is_hidden boolean not null default false
);

create table if not exists public.comments (
  id text primary key,
  novel_id text not null references public.novels(id) on delete cascade,
  name text not null,
  text text not null,
  date timestamptz not null default now(),
  vote integer not null default 0 check (vote between -2 and 2)
);

-- Supabase Auth users that can edit/delete/hide posts.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- DB-level CHECK constraints (second line of defence)
alter table public.novels
  drop constraint if exists novels_title_length,
  drop constraint if exists novels_body_length,
  drop constraint if exists novels_author_length,
  add constraint novels_title_length  check (length(title) between 1 and 200),
  add constraint novels_body_length   check (length(body)  between 1 and 100000),
  add constraint novels_author_length check (length(author) <= 100);

alter table public.comments
  drop constraint if exists comments_text_length,
  drop constraint if exists comments_name_length,
  add constraint comments_text_length check (length(text) between 1 and 500),
  add constraint comments_name_length check (length(name) <= 100);

alter table public.novels enable row level security;
alter table public.comments enable row level security;
alter table public.admin_users enable row level security;

-- Public read access
drop policy if exists novels_select_public on public.novels;
create policy novels_select_public on public.novels
for select using (true);

drop policy if exists comments_select_public on public.comments;
create policy comments_select_public on public.comments
for select using (true);

-- Public posting
-- 値の制約は RLS + DB CHECK の二重で防御する。
-- AI/API からの直接投稿を許容しつつ、is_hidden, view_count の偽装や
-- 制限超過テキストの投入を防ぐ。

drop policy if exists novels_insert_public on public.novels;
create policy novels_insert_public on public.novels
for insert
with check (
  is_hidden = false
  and view_count = 0
  and length(title) between 1 and 200
  and length(body)  between 1 and 100000
  and length(author) <= 100
  and (
    not exists (select 1 from public.novels)
    or ("date")::timestamptz >= (select max((n.date)::timestamptz) from public.novels n)
  )
  and ("date")::timestamptz <= now() + interval '5 minutes'
);

drop policy if exists comments_insert_public on public.comments;
create policy comments_insert_public on public.comments
for insert
with check (
  length(text) between 1 and 500
  and length(name) <= 100
  and vote between -2 and 2
  and (
    not exists (select 1 from public.comments)
    or ("date")::timestamptz >= (select max((c.date)::timestamptz) from public.comments c)
  )
  and ("date")::timestamptz <= now() + interval '5 minutes'
);

-- Only admin users can edit/delete rows
drop policy if exists novels_update_admin_only on public.novels;
create policy novels_update_admin_only on public.novels
for update using (
  exists (
    select 1 from public.admin_users au
    where au.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.admin_users au
    where au.user_id = auth.uid()
  )
);

drop policy if exists novels_delete_admin_only on public.novels;
create policy novels_delete_admin_only on public.novels
for delete using (
  exists (
    select 1 from public.admin_users au
    where au.user_id = auth.uid()
  )
);

drop policy if exists comments_delete_admin_only on public.comments;
create policy comments_delete_admin_only on public.comments
for delete using (
  exists (
    select 1 from public.admin_users au
    where au.user_id = auth.uid()
  )
);

-- A safe public RPC to increment only view_count.
create or replace function public.increment_novel_view(target_novel_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.novels
     set view_count = view_count + 1
   where id = target_novel_id;
$$;

revoke all on function public.increment_novel_view(text) from public;
grant execute on function public.increment_novel_view(text) to anon, authenticated;

-- Optional hardening: keep admin_users list private.
drop policy if exists admin_users_select_self on public.admin_users;
create policy admin_users_select_self on public.admin_users
for select using (auth.uid() = user_id);

-- How to assign an admin user (run after creating auth user):
-- insert into public.admin_users (user_id)
-- values ('<auth.users.id UUID>');

-- Migration for existing databases (run once):
-- ALTER TABLE public.novels ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
-- ALTER TABLE public.novels ADD COLUMN IF NOT EXISTS description text;
