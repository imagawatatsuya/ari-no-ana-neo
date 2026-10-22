-- Apply after all earlier migrations. Transactional and safe to re-run.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Explicit grants work with both old and new Supabase default-privilege setups.
-- TRUNCATE bypasses RLS, so do not inherit the old blanket table grants.
revoke all on public.novels, public.comments, public.admin_users from anon, authenticated;
grant select, insert on public.novels, public.comments to anon, authenticated;
grant update, delete on public.novels to authenticated;
grant delete on public.comments to authenticated;
grant select on public.admin_users to anon, authenticated;

-- Restrictive policies also protect installations with additional permissive policies.
drop policy if exists novels_select_public on public.novels;
create policy novels_select_public on public.novels for select to anon, authenticated using (true);
drop policy if exists novels_visibility_guard on public.novels;
create policy novels_visibility_guard on public.novels as restrictive for select to anon, authenticated
using (not is_hidden or exists (select 1 from public.admin_users where user_id = (select auth.uid())));

drop policy if exists comments_select_public on public.comments;
create policy comments_select_public on public.comments for select to anon, authenticated using (true);
drop policy if exists comments_visibility_guard on public.comments;
create policy comments_visibility_guard on public.comments as restrictive for select to anon, authenticated
using (exists (select 1 from public.novels where id = novel_id));

-- Remove the cross-user max(date) rule. A trigger supplies authoritative server time.
drop policy if exists novels_insert_public on public.novels;
create policy novels_insert_public on public.novels for insert to anon, authenticated
with check (not is_hidden and view_count = 0 and not is_ryuseigai);
drop policy if exists comments_insert_public on public.comments;
create policy comments_insert_public on public.comments for insert to anon, authenticated
with check (exists (select 1 from public.novels where id = novel_id and not is_hidden));

-- No raw IP addresses are retained. Only the DB owner can inspect/change buckets.
create table if not exists private.posting_rate_limits (
  actor_hash text not null,
  channel text not null,
  posted_at timestamptz not null,
  primary key (actor_hash, channel)
);
create index if not exists posting_rate_limits_age on private.posting_rate_limits(posted_at);
alter table private.posting_rate_limits enable row level security;
revoke all on private.posting_rate_limits from public, anon, authenticated;

create or replace function private.guard_public_post()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  headers jsonb;
  client_ip text;
  actor text;
  accepted boolean;
begin
  -- SQL maintenance and trusted service-role jobs keep their original timestamps.
  if current_setting('role', true) not in ('anon', 'authenticated') then return new; end if;
  headers := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  -- Take the rightmost address appended by the trusted API reverse proxy.
  client_ip := nullif(btrim(regexp_replace(coalesce(headers->>'x-forwarded-for', ''), '^.*,', '')), '');
  if client_ip is not null then
    begin
      client_ip := (client_ip::inet)::text;
    exception when invalid_text_representation then
      client_ip := null;
    end;
  end if;
  -- Missing proxy metadata shares a bucket; it never disables the limiter.
  actor := coalesce(client_ip, auth.uid()::text, 'anonymous-no-proxy');
  actor := encode(sha256(convert_to(actor, 'UTF8')), 'hex');
  insert into private.posting_rate_limits as limits(actor_hash, channel, posted_at)
    values (actor, tg_table_name, clock_timestamp())
    on conflict (actor_hash, channel) do update set posted_at = excluded.posted_at
      where limits.posted_at <= excluded.posted_at - interval '60 seconds'
    returning true into accepted;
  if accepted is not true then
    raise exception using errcode = 'P0001', message = '連続投稿は60秒後に再度お試しください。';
  end if;
  delete from private.posting_rate_limits where posted_at < clock_timestamp() - interval '1 day';
  new.date := clock_timestamp();
  return new;
end;
$$;
revoke all on function private.guard_public_post() from public, anon, authenticated;
drop trigger if exists guard_public_post on public.novels;
create trigger guard_public_post before insert on public.novels for each row execute function private.guard_public_post();
drop trigger if exists guard_public_post on public.comments;
create trigger guard_public_post before insert on public.comments for each row execute function private.guard_public_post();

create or replace function private.validate_comment_vote()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  ryuseigai boolean;
begin
  -- Historical votes survive moving a novel between sections. New/changed votes
  -- must match the destination; editing only the comment text preserves history.
  if tg_op = 'UPDATE' and new.vote is not distinct from old.vote and new.novel_id = old.novel_id then return new; end if;
  select is_ryuseigai into ryuseigai from public.novels where id = new.novel_id for share;
  if not found then raise foreign_key_violation using message = '投稿先が見つかりません。'; end if;
  if new.vote is not null and not (
    (not ryuseigai and new.vote in (-2, -1, 0, 1, 2))
    or (ryuseigai and new.vote in (-500, -1000))
  ) then
    raise check_violation using message = '投稿先に使用できない採点値です。';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_comment_vote() from public, anon, authenticated;
drop trigger if exists validate_comment_vote on public.comments;
create trigger validate_comment_vote before insert or update on public.comments for each row execute function private.validate_comment_vote();

-- A definer RPC must explicitly enforce visibility, since it bypasses RLS.
create or replace function public.increment_novel_view(target_novel_id text)
returns void language sql security definer set search_path = '' as $$
  update public.novels set view_count = view_count + 1 where id = target_novel_id and not is_hidden;
$$;
revoke all on function public.increment_novel_view(text) from public;
grant execute on function public.increment_novel_view(text) to anon, authenticated;

create table if not exists private.app_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);
revoke all on private.app_migrations from public, anon, authenticated;
insert into private.app_migrations(version) values ('20261022_public_access_hardening') on conflict do nothing;
commit;
