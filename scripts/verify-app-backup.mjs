// Restore the application-scoped dashboard export into a disposable DB, then
// prove that the security migrations preserve every existing application row.
// Never prints record contents. Auth service data is outside this backup scope.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

const backup = JSON.parse(await readFile(process.argv[2], 'utf8'));
const db = new PGlite();
const quote = name => '"' + name.replaceAll('"','""') + '"';
const canonical = value => JSON.stringify(Object.fromEntries(Object.keys(value).sort().map(key => {
  // Different PG builds serialize a UTC timestamp as +00:00 or +00. Retain
  // fractional seconds while normalizing only the equivalent timezone suffix.
  const item = value[key];
  return [key, key === 'created_at' && typeof item === 'string' ? item.replace(/(?:Z|\+00:00|\+00)$/, '+00').replace(' ', 'T') : item];
})));
const digest = rows => createHash('sha256').update(rows.map(canonical).sort().join('\n')).digest('hex');
const restoredRows = async table => (await db.query(`select to_jsonb(t) as row from public.${quote(table)} t`)).rows.map(r=>r.row);
try {
  await db.exec("set timezone = 'UTC'");
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth,public to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
  for (const table of ['novels','comments','admin_users']) {
    const columns = backup.columns.filter(c => c.table_name === table).sort((a,b) => a.ordinal_position-b.ordinal_position);
    assert.ok(columns.length > 0, `Missing schema for ${table}`);
    const defs = columns.map(c => `${quote(c.column_name)} ${c.udt_name === 'int8' ? 'bigint' : c.udt_name === 'int4' ? 'integer' : c.udt_name} ${c.column_default ? 'default '+c.column_default : ''} ${c.is_nullable==='NO' ? 'not null' : ''}`);
    await db.exec(`create table public.${quote(table)} (${defs.join(',')})`);
  }
  for (const row of backup.admin_users) await db.query('insert into auth.users(id) values($1) on conflict do nothing',[row.user_id]);
  for (const constraint of backup.constraints || []) await db.exec(`alter table public.${quote(constraint.table.replace(/^public\./,''))} add constraint ${quote(constraint.name)} ${constraint.definition}`);
  for (const table of ['novels','comments','admin_users']) {
    for (const row of backup[table]) {
      const fields = Object.keys(row);
      await db.query(`insert into public.${quote(table)} (${fields.map(quote).join(',')}) values (${fields.map((_,i)=>'$'+(i+1)).join(',')})`, fields.map(f=>row[f]));
    }
    assert.equal(digest(await restoredRows(table)),digest(backup[table]),`Restore mismatch: ${table}`);
    console.log(`${table}: ${backup[table].length} rows restored and verified`);
  }
  for (const file of ['20261022_public_access_hardening.sql','20261022_security_attestation.sql']) await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  for (const table of ['novels','comments','admin_users']) assert.equal(digest(await restoredRows(table)),digest(backup[table]),`Migration changed ${table}`);
  assert.equal((await db.query('select public.security_health() as ok')).rows[0].ok,true);
  await db.exec('set role anon');
  assert.equal((await db.query('select count(*)::int as n from public.novels where is_hidden')).rows[0].n,0);
  console.log('Both migrations passed; all application rows unchanged; anonymous hidden reads denied.');
} finally { await db.close(); }
