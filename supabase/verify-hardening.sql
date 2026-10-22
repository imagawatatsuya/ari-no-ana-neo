-- Read-only checks for SQL Editor, run as the DB owner after migration.
select version, applied_at from private.app_migrations order by version;

select c.relname, c.relrowsecurity as must_be_true
from pg_class c where c.oid in ('public.novels'::regclass, 'public.comments'::regclass, 'public.admin_users'::regclass);

select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public' and tablename in ('novels', 'comments')
order by tablename, policyname;

select event_object_table, trigger_name, event_manipulation
from information_schema.triggers where trigger_schema = 'public'
  and trigger_name in ('guard_public_post', 'validate_comment_vote');

-- Anonymous reads must contain no hidden works or their comments.
begin;
do $$ begin
  perform set_config('app.hidden_ids', coalesce((select json_agg(id)::text from public.novels where is_hidden), '[]'), true);
end $$;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select count(*) as must_be_zero from public.novels where is_hidden;
select count(*) as hidden_comments_must_be_zero from public.comments
where novel_id in (select json_array_elements_text(current_setting('app.hidden_ids')::json));
rollback;

select has_table_privilege('anon', 'private.posting_rate_limits', 'select') as must_be_false,
       has_table_privilege('authenticated', 'private.posting_rate_limits', 'insert') as must_also_be_false;
