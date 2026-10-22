-- Apply after public_access_hardening. No user data is changed.
begin;
alter table private.app_migrations enable row level security;
do $$ begin
  if not exists (select 1 from private.app_migrations where version = '20261022_public_access_hardening')
     or (select count(*) from pg_class where oid in ('public.novels'::regclass, 'public.comments'::regclass, 'public.admin_users'::regclass) and relrowsecurity) <> 3
     or has_table_privilege('anon', 'public.novels', 'update,delete,truncate')
     or has_table_privilege('anon', 'public.comments', 'update,delete,truncate')
     or has_table_privilege('authenticated', 'public.admin_users', 'insert,update,delete,truncate') then
    raise exception 'Apply public_access_hardening before recording the security baseline';
  end if;
end $$;

create table if not exists private.security_baseline (
  version text primary key,
  fingerprint text not null,
  recorded_at timestamptz not null default now()
);
alter table private.security_baseline enable row level security;
revoke all on private.security_baseline from public, anon, authenticated;

-- Catalog definitions, ACLs and trigger state are included; user records are not.
create or replace function private.security_fingerprint()
returns text language sql stable security definer set search_path = '' as $$
  select md5(coalesce(string_agg(item, E'\n' order by item), '')) from (
    select 'table:' || n.nspname || '.' || c.relname || ':' || c.relrowsecurity || ':' || c.relforcerowsecurity || ':' || coalesce(c.relacl::text, '') as item
    from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where (n.nspname = 'public' and c.relname in ('novels','comments','admin_users'))
       or (n.nspname = 'private' and c.relname in ('posting_rate_limits','app_migrations','security_baseline'))
    union all
    select 'policy:' || p.polrelid::regclass::text || ':' || p.polname || ':' || p.polcmd::text || ':' || p.polpermissive || ':' || p.polroles::text || ':' || coalesce(pg_catalog.pg_get_expr(p.polqual,p.polrelid),'') || ':' || coalesce(pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid),'')
    from pg_catalog.pg_policy p where p.polrelid in ('public.novels'::regclass,'public.comments'::regclass,'public.admin_users'::regclass)
    union all
    select 'trigger:' || t.tgrelid::regclass::text || ':' || pg_catalog.pg_get_triggerdef(t.oid) || ':' || t.tgenabled::text
    from pg_catalog.pg_trigger t where not t.tgisinternal and t.tgrelid in ('public.novels'::regclass,'public.comments'::regclass)
    union all
    select 'constraint:' || c.conrelid::regclass::text || ':' || c.conname || ':' || pg_catalog.pg_get_constraintdef(c.oid)
    from pg_catalog.pg_constraint c where c.conrelid in ('public.novels'::regclass,'public.comments'::regclass,'public.admin_users'::regclass)
    union all
    select 'function:' || replace(pg_catalog.pg_get_functiondef(p.oid), E'\r', '') || ':' || coalesce(p.proacl::text,'')
    from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'private' and p.proname in ('guard_public_post','validate_comment_vote','security_fingerprint'))
       or (n.nspname = 'public' and p.proname in ('list_public_novels','increment_novel_view','security_health'))
    union all
    select 'schema:' || n.nspname || ':' || coalesce(n.nspacl::text,'') from pg_catalog.pg_namespace n where n.nspname = 'private'
  ) definitions;
$$;
revoke all on function private.security_fingerprint() from public, anon, authenticated;

-- Only an aggregate boolean is exposed; no IDs, records, hashes or policies.
create or replace function public.security_health()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select fingerprint = private.security_fingerprint()
    from private.security_baseline where version = '20261022_security_attestation'
  ), false)
  and exists (select 1 from private.app_migrations where version = '20261022_public_access_hardening')
  and exists (select 1 from private.app_migrations where version = '20261022_security_attestation');
$$;
revoke all on function public.security_health() from public, anon, authenticated;
grant execute on function public.security_health() to anon, authenticated;

-- Never silently bless drift on replay. Deliberate schema changes need a reviewed
-- migration to validate and replace the baseline.
insert into private.security_baseline(version, fingerprint)
values ('20261022_security_attestation', private.security_fingerprint()) on conflict do nothing;
insert into private.app_migrations(version) values ('20261022_security_attestation') on conflict do nothing;
do $$ begin
  if not public.security_health() then raise exception 'Security baseline mismatch'; end if;
end $$;
notify pgrst, 'reload schema';
commit;
