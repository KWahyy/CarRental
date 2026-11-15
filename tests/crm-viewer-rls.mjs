// Run with PGLITE_MODULE pointing to an installed @electric-sql/pglite module.
// Isolated PostgreSQL database; never connects to production.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {PGlite}=await import(process.env.PGLITE_MODULE);
const pg=new PGlite();
const migration=await readFile(new URL('../supabase/dashboard-viewer.sql',import.meta.url),'utf8');
const tables=[...migration.matchAll(/'([a-z_]+)'/g)].map(m=>m[1]).filter(n=>!['owner','manager','staff','viewer','public','fleet','authenticated'].includes(n));
const names=[...new Set(tables)];
await pg.exec(`create role authenticated; create schema auth; create schema storage;
create function auth.uid() returns uuid language sql stable as $$select current_setting('request.jwt.claim.sub',true)::uuid$$;
grant usage on schema public,auth,storage to authenticated;
create table public.admin_profiles(user_id uuid primary key,role text constraint admin_profiles_role_check check(role in ('owner','manager','staff')));
create function public.is_invoice_employee() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from admin_profiles where user_id=auth.uid() and role in ('owner','manager','staff'))$$;
create table storage.objects(id int primary key,bucket_id text);
insert into storage.objects values (1,'invoice-pdfs');
`);
for(const table of names.filter(n=>n!=='admin_profiles'))await pg.exec(`create table public.${table}(id int primary key, value text); insert into public.${table} values(1,'original');`);
for(const table of [...names.map(n=>`public.${n}`),'storage.objects'])await pg.exec(`alter table ${table} enable row level security; grant all on ${table} to authenticated; create policy legacy_manage on ${table} for all to authenticated using(true) with check(true);`);
await pg.exec(migration);
await pg.exec(migration); // idempotence
const viewer='00000000-0000-0000-0000-000000000001',owner='00000000-0000-0000-0000-000000000002';
await pg.exec(`insert into admin_profiles values('${viewer}','viewer'),('${owner}','owner');set role authenticated;set request.jwt.claim.sub='${viewer}';`);
for(const table of names.filter(n=>n!=='admin_profiles')){
 assert.equal((await pg.query(`select * from ${table}`)).rows.length,1,`${table}: viewer read`);
 await assert.rejects(pg.exec(`insert into ${table} values(2,'bad')`),undefined,`${table}: insert denied`);
 assert.equal((await pg.query(`update ${table} set value='bad' returning id`)).rows.length,0,`${table}: update denied`);
 assert.equal((await pg.query(`delete from ${table} returning id`)).rows.length,0,`${table}: delete denied`);
}
assert.equal((await pg.query(`update admin_profiles set role='owner' where user_id='${viewer}' returning user_id`)).rows.length,0,'role escalation denied');
await assert.rejects(pg.exec(`insert into storage.objects values(2,'fleet')`));
assert.equal((await pg.query(`delete from storage.objects returning id`)).rows.length,0);
assert.equal((await pg.query(`update storage.objects set bucket_id='fleet' returning id`)).rows.length,0);
await pg.exec(`set request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';`);
await assert.rejects(pg.exec(`insert into cars values(3,'unprovisioned user')`));
await pg.exec(`set request.jwt.claim.sub='${owner}';insert into cars values(2,'owner edit');update cars set value='allowed' where id=2;`);
assert.equal((await pg.query('select value from cars where id=2')).rows[0].value,'allowed');
console.log(`PASS: ${names.length} CRM tables + storage: viewer reads allowed, writes and role escalation denied; owner writes preserved; migration idempotent.`);
await pg.exec('reset role; drop table quote_activities;');
await pg.exec(migration);
console.log('PASS: migration supports production without the retired quote_activities table.');
await pg.close();
