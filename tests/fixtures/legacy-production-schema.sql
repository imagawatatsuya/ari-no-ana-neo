-- Schema-only fixture from the 2026-10-22 read-only production audit.
-- No user records or credentials. This intentionally differs from schema v2.
create table public.novels (
  id text primary key, title text not null, author text not null, trip text,
  body text not null, date text not null, view_count bigint default 0,
  is_hidden boolean not null default false, description text,
  is_ryuseigai boolean not null default false,
  author_indent_mode text not null default 'raw', author_message text,
  constraint novels_author_indent_mode check (author_indent_mode in ('none','jisage','raw')),
  constraint novels_author_message_length check (author_message is null or length(author_message) <= 500)
);
create table public.comments (
  id text primary key, novel_id text references public.novels(id), name text not null,
  text text not null, date text not null, vote integer,
  constraint comments_vote_range check (vote is null or vote between -1000 and 2)
);
create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
create policy admin_users_select_self on public.admin_users for select using (auth.uid() = user_id);
create policy novels_insert_public on public.novels for insert with check (
  not is_hidden and view_count = 0 and length(title) between 1 and 200
  and length(body) between 1 and 100000 and length(author) <= 100
);
create policy comments_insert_public on public.comments for insert with check (
  length(text) between 1 and 500 and length(name) <= 100 and (vote is null or vote between -1000 and 2)
);
grant all on public.novels, public.comments, public.admin_users to anon, authenticated;
-- novels/comments RLS, SELECT/admin mutation policies and the view-count RPC
-- were all absent. Date columns have no defaults, unlike the fresh v2 schema.
