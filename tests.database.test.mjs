import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const sqlFile = (name) => readFile(new URL(name, import.meta.url), 'utf8');
const migrationPath = './supabase/migrations/20261022_public_access_hardening.sql';

for (const mode of ['fresh', 'upgrade', 'legacy-production']) {
  test(`database ${mode}: visibility, posting limits, votes and migration replay`, async (t) => {
    const db = new PGlite();
    t.after(() => db.close());
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth, public to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
    `);
    const schema = (await sqlFile('./supabase_schema_v2.sql')).replace('create extension if not exists pgcrypto;', '');
    const marker = '-- Current access and posting policies';
    await db.exec(mode === 'fresh' ? schema : mode === 'legacy-production'
      ? await sqlFile('./tests/fixtures/legacy-production-schema.sql')
      : schema.split(marker)[0].replaceAll('date timestamptz', 'date text'));
    if (mode !== 'fresh') {
      await db.exec(await sqlFile(migrationPath));
    }
    await db.exec(await sqlFile(migrationPath));
    assert.equal((await db.query("select has_table_privilege('anon','public.novels','truncate') as allowed")).rows[0].allowed, false);
    assert.equal((await db.query("select has_table_privilege('anon','public.novels','update') as allowed")).rows[0].allowed, false);
    assert.equal((await db.query("select has_table_privilege('authenticated','public.novels','update') as allowed")).rows[0].allowed, true);
    assert.equal((await db.query("select count(*)::integer as enabled from pg_class where oid in ('public.novels'::regclass,'public.comments'::regclass,'public.admin_users'::regclass) and relrowsecurity")).rows[0].enabled, 3);
    await db.exec(`
      grant select, insert, update, delete on public.novels, public.comments to anon, authenticated;
      grant select on public.admin_users to anon, authenticated;
      insert into auth.users values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
      insert into public.admin_users(user_id) values ('00000000-0000-0000-0000-000000000001');
      insert into public.novels(id,title,author,body,date,is_hidden,is_ryuseigai) values
        ('public','公開','作者','本文',now(),false,false), ('hidden','非表示','作者','秘密',now(),true,false),
        ('ryuseigai','流星垓','作者','本文',now(),false,true);
      insert into public.comments(id,novel_id,name,text,date,vote) values
        ('visible','public','名','公開感想',now(),0), ('secret','hidden','名','秘密の感想',now(),null);
      create policy test_permissive_novels on public.novels for select using (true);
      create policy test_permissive_comments on public.comments for select using (true);
      set role anon;
    `);
    const rows = async (query) => (await db.query(query)).rows;
    assert.deepEqual((await rows('select id from public.novels order by id')).map(r => r.id), ['public', 'ryuseigai']);
    assert.deepEqual((await rows('select id from public.comments')).map(r => r.id), ['visible']);
    await assert.rejects(db.exec('select * from private.posting_rate_limits'), /permission denied/);
    assert.equal((await rows("update public.novels set title='改ざん' where id='public' returning id")).length, 0);
    assert.equal((await rows("delete from public.comments where id='visible' returning id")).length, 0);
    await assert.rejects(db.exec("insert into public.comments values ('hidden-post','hidden','N','T',now(),1)"), /row-level security/);
    await db.exec("select public.increment_novel_view('hidden'); reset role;");
    assert.equal((await rows("select view_count from public.novels where id='hidden'"))[0].view_count, 0);
    if (mode === 'legacy-production') await db.exec("update public.novels set view_count=null where id='public'");
    await db.exec("set role anon; select public.increment_novel_view('public'); reset role;");
    assert.equal(Number((await rows("select view_count from public.novels where id='public'"))[0].view_count), 1);

    await db.exec("set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false)");
    assert.equal((await rows("select id from public.novels where id='hidden'")).length, 0);
    await db.exec("select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false)");
    assert.equal((await rows("select id from public.novels where id='hidden'")).length, 1);
    assert.equal((await rows("select id from public.comments where id='secret'")).length, 1);
    await db.exec("reset role; insert into public.novels(id,title,author,body,date,is_hidden) values ('admin-delete','T','A','B',now(),true); insert into public.comments(id,novel_id,name,text,date,vote) values ('admin-delete-comment','admin-delete','N','T',now(),null); set role authenticated;");
    assert.equal((await rows("delete from public.comments where id='admin-delete-comment' returning id")).length, 1);
    assert.equal((await rows("delete from public.novels where id='admin-delete' returning id")).length, 1);
    await db.exec("update public.novels set title='管理編集' where id='hidden'; reset role; select set_config('request.jwt.claim.sub','',false); set role anon;");

    await db.exec("select set_config('request.headers','{\"x-forwarded-for\":\"198.51.100.1\"}',false)");
    await assert.rejects(db.exec("insert into public.novels(id,title,author,body) values ('empty-title','','A','B')"), /novels_title_length/);
    await assert.rejects(db.exec("insert into public.comments(id,novel_id,name,text,date,vote) values ('long-comment','public','N',repeat('x',501),now(),1)"), /comments_text_length/);
    await db.exec("insert into public.novels(id,title,author,body,date) values ('first','T','A','B','2099-01-01')");
    const post = (id) => db.exec(`insert into public.novels(id,title,author,body) values ('${id}','T','A','B')`);
    await assert.rejects(post('second'), /60秒/);
    // A forged prefix does not change the rightmost proxy-appended address.
    await db.exec("select set_config('request.headers','{\"x-forwarded-for\":\"192.0.2.99, 198.51.100.1\"}',false)");
    await assert.rejects(post('prefix'), /60秒/);
    // Separate clients are not subject to a site-wide cooldown.
    await db.exec("select set_config('request.headers','{\"x-forwarded-for\":\"198.51.100.2\"}',false)");
    await post('other-client');
    const comment = (id, parent, vote) => db.exec(`insert into public.comments(id,novel_id,name,text,date,vote) values ('${id}','${parent}','N','T',now(),${vote})`);
    await assert.rejects(comment('bad-normal', 'public', -500), /採点値/);
    await assert.rejects(comment('bad-range', 'public', -999), /採点値/);
    await assert.rejects(comment('bad-ryuseigai', 'ryuseigai', 2), /採点値/);
    await comment('normal-zero', 'public', 0);
    await assert.rejects(comment('rapid-comment', 'public', 1), /60秒/);
    await db.exec("reset role; update private.posting_rate_limits set posted_at=now()-interval '61 seconds'; set role anon;");
    await comment('ryuseigai-vote', 'ryuseigai', -1000);
    await db.exec("reset role; update private.posting_rate_limits set posted_at=now()-interval '61 seconds'; set role anon;");
    await comment('unrated', 'public', 'null');
    await db.exec("select set_config('request.headers','{}',false)");
    await post('missing-metadata');
    await assert.rejects(post('missing-metadata-again'), /60秒/);
    await db.exec('reset role');
    await db.exec("update private.posting_rate_limits set posted_at=now()-interval '61 seconds'; set role anon;");
    await assert.rejects(db.exec("insert into public.novels(id,title,author,body) values ('bulk-1','T','A','B'),('bulk-2','T','A','B')"), /60秒/);
    assert.equal((await rows("select id from public.novels where id like 'bulk-%'")).length, 0);
    await post('after-bulk-rollback');
    await db.exec('reset role');
    assert.ok(new Date((await rows("select date from public.novels where id='first'"))[0].date).getUTCFullYear() < 2099);
    // Historical normal votes are retained when an admin moves the work.
    await db.exec("update public.novels set is_ryuseigai=true where id='public'");
    assert.equal((await rows("select vote from public.comments where id='normal-zero'"))[0].vote, 0);
    await db.exec(await sqlFile(migrationPath));
    assert.equal((await rows("select vote from public.comments where id='normal-zero'"))[0].vote, 0);
    await db.exec("update public.comments set text='履歴の本文編集' where id='visible'");
    await assert.rejects(db.exec("update public.comments set vote=2 where id='visible'"), /採点値/);
    await db.exec("update public.comments set vote=-500 where id='visible'");
    // Earlier assertions deliberately re-granted DML to exercise RLS itself.
    await db.exec(await sqlFile(migrationPath));
    const attestation = await sqlFile('./supabase/migrations/20261022_security_attestation.sql');
    await db.exec(attestation);
    await db.exec(attestation);
    await db.exec(await sqlFile('./supabase/verify-hardening.sql'));
    const healthy = async () => (await rows('select public.security_health() as healthy'))[0].healthy;
    assert.equal(await healthy(), true);
    await db.exec("begin; delete from private.app_migrations where version='20261022_security_attestation'");
    assert.equal(await healthy(), false, 'Missing migration history must fail closed');
    await db.exec('rollback');
    for (const drift of [
      'alter table public.novels disable row level security',
      'grant update on public.novels to anon',
      'drop policy novels_visibility_guard on public.novels',
      'alter table public.comments disable trigger guard_public_post',
      `create or replace function private.guard_public_post() returns trigger language plpgsql security definer set search_path='' as $$ begin return new; end $$`,
      'grant insert on public.admin_users to authenticated',
    ]) {
      await db.exec('begin');
      await db.exec(drift);
      assert.equal(await healthy(), false, drift);
      await assert.rejects(db.exec(attestation), /baseline|hardening/);
      await db.exec('rollback');
      assert.equal(await healthy(), true);
    }
    await db.exec('set role anon');
    assert.equal(await healthy(), true);
    await assert.rejects(db.exec('select * from private.security_baseline'), /permission denied/);
  });
}
