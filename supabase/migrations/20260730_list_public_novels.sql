-- Performance: single-query public novel list with comment aggregates
-- Run in Supabase SQL Editor after supabase_schema_v2.sql

create or replace function public.list_public_novels(
  p_offset integer default 0,
  p_limit integer default 20,
  p_search text default null,
  p_is_ryuseigai boolean default false
)
returns table (
  id text,
  title text,
  author text,
  trip text,
  date timestamptz,
  view_count integer,
  comment_count bigint,
  vote_sum bigint,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    n.id,
    n.title,
    n.author,
    n.trip,
    n.date,
    n.view_count,
    count(c.id) as comment_count,
    coalesce(sum(c.vote), 0) as vote_sum,
    count(*) over() as total_count
  from public.novels n
  left join public.comments c on c.novel_id = n.id
  where
    n.is_hidden = false
    and n.is_ryuseigai = p_is_ryuseigai
    and (
      p_search is null
      or p_search = ''
      or n.title ilike '%' || p_search || '%'
      or n.author ilike '%' || p_search || '%'
    )
  group by n.id
  order by n.date desc
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 100);
$$;

revoke all on function public.list_public_novels(integer, integer, text, boolean) from public;
grant execute on function public.list_public_novels(integer, integer, text, boolean) to anon, authenticated;

-- Indexes for list queries (partial indexes match filter conditions)
create index if not exists novels_public_latest_idx
  on public.novels (date desc)
  where is_hidden = false and is_ryuseigai = false;

create index if not exists novels_ryuseigai_latest_idx
  on public.novels (date desc)
  where is_hidden = false and is_ryuseigai = true;

create index if not exists comments_novel_id_idx
  on public.comments (novel_id);
