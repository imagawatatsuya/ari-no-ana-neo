-- Supabase schema for 文章アリの穴NEO
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.novels (
  id text primary key,
  title text not null,
  author text not null,
  trip text,
  body text not null,
  date timestamptz not null default now(),
  view_count integer not null default 0 check (view_count >= 0)
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

alter table public.novels enable row level security;
alter table public.comments enable row level security;
alter table public.admin_users enable row level security;

-- Public read access
create policy if not exists novels_select_public on public.novels
for select using (true);

create policy if not exists comments_select_public on public.comments
for select using (true);

-- Public posting
create policy if not exists novels_insert_public on public.novels
for insert with check (true);

create policy if not exists comments_insert_public on public.comments
for insert with check (true);

-- Only admin users can edit/delete rows
create policy if not exists novels_update_admin_only on public.novels
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

create policy if not exists novels_delete_admin_only on public.novels
for delete using (
  exists (
    select 1 from public.admin_users au
    where au.user_id = auth.uid()
  )
);

create policy if not exists comments_delete_admin_only on public.comments
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
create policy if not exists admin_users_select_self on public.admin_users
for select using (auth.uid() = user_id);

-- How to assign an admin user (run after creating auth user):
-- insert into public.admin_users (user_id)
-- values ('<auth.users.id UUID>');
