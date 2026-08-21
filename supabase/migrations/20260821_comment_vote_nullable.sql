-- 未採点は null。既存の vote=0 は旧UIの「採点しない」なので null へ移す。
-- ポイント集計は非 null の票だけを対象にする。

alter table public.comments
  alter column vote drop not null;

alter table public.comments
  alter column vote drop default;

update public.comments
set vote = null
where vote = 0;

alter table public.comments
  drop constraint if exists comments_vote_range;

alter table public.comments
  add constraint comments_vote_range
  check (vote is null or vote between -1000 and 2);

drop policy if exists comments_insert_public on public.comments;
create policy comments_insert_public on public.comments
for insert
with check (
  length(text) between 1 and 500
  and length(name) <= 100
  and (vote is null or vote between -1000 and 2)
  and (
    not exists (select 1 from public.comments)
    or ("date")::timestamptz >= (select max((c.date)::timestamptz) from public.comments c)
  )
  and ("date")::timestamptz <= now() + interval '5 minutes'
);

drop function if exists public.list_public_novels(integer, integer, text, boolean);

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
  date text,
  view_count integer,
  comment_count bigint,
  vote_count bigint,
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
    n.date::text,
    n.view_count,
    count(c.id) as comment_count,
    count(c.vote) as vote_count,
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
  order by (n.date)::timestamptz desc
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 100);
$$;

revoke all on function public.list_public_novels(integer, integer, text, boolean) from public;
grant execute on function public.list_public_novels(integer, integer, text, boolean) to anon, authenticated;
