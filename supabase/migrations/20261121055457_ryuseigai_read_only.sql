-- Keep works and historical reactions intact while closing public reactions.
begin;

do $$ begin
  if not public.security_health() then
    raise exception 'Security baseline mismatch before enabling read-only Ryuseigai';
  end if;
end $$;

alter policy comments_visibility_guard on public.comments using (
  exists (
    select 1 from public.novels n
    where n.id = novel_id
      and (not n.is_ryuseigai or exists (
        select 1 from public.admin_users where user_id = (select auth.uid())
      ))
  )
);

alter policy comments_insert_public on public.comments with check (
  exists (select 1 from public.novels n where n.id = novel_id and not n.is_hidden and not n.is_ryuseigai)
);

create or replace function private.validate_comment_vote()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  ryuseigai boolean;
begin
  -- An administrator can edit the text of a historical comment without changing its vote.
  if tg_op = 'UPDATE' and new.vote is not distinct from old.vote and new.novel_id = old.novel_id then return new; end if;
  -- Serialize reactions with an administrator moving the parent work.
  select is_ryuseigai into ryuseigai from public.novels where id = new.novel_id for share;
  if not found then raise foreign_key_violation using message = '投稿先が見つかりません。'; end if;
  if ryuseigai then raise check_violation using message = '流星垓の作品には反応を追加できません。'; end if;
  if new.vote is not null and new.vote not in (-2, -1, 0, 1, 2) then
    raise check_violation using message = '投稿先に使用できない採点値です。';
  end if;
  return new;
end;
$$;

create or replace function public.increment_novel_view(target_novel_id text)
returns void language sql security definer set search_path = '' as $$
  update public.novels set view_count = coalesce(view_count, 0) + 1
  where id = target_novel_id and not is_hidden and not is_ryuseigai;
$$;

create or replace function public.security_health()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select fingerprint = private.security_fingerprint()
    from private.security_baseline where version = '20261121055457_ryuseigai_read_only'
  ), false)
  and (select count(*) = 3 from private.app_migrations where version in (
    '20261022_public_access_hardening', '20261022_security_attestation', '20261121055457_ryuseigai_read_only'
  ));
$$;

insert into private.app_migrations(version) values ('20261121055457_ryuseigai_read_only') on conflict do nothing;
insert into private.security_baseline(version, fingerprint)
values ('20261121055457_ryuseigai_read_only', private.security_fingerprint()) on conflict do nothing;

do $$ begin
  if not public.security_health() then raise exception 'Security baseline mismatch after enabling read-only Ryuseigai'; end if;
end $$;

notify pgrst, 'reload schema';
commit;
