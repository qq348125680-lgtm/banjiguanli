import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('guardian relationships are isolated and cannot be mistaken for parent auth accounts',()=>{
 const sql=read('sql/v7_guardian_links_STAGING_ONLY.sql');
 assert.match(sql,/STAGING ONLY/);
 assert.match(sql,/create table public\.v7_guardian_links/);
 assert.match(sql,/create table public\.v7_guardian_link_history/);
 assert.match(sql,/verification_status text not null default '待核实'/);
 assert.match(sql,/unique\(class_id,request_key\)/);
 assert.match(sql,/v7_guardian_active_phone/);
 assert.doesNotMatch(sql,/auth\.users|create user|create role/i);
});
test('guardian contacts are owner-only and never writable as raw table rows',()=>{
 const sql=read('sql/v7_guardian_links_STAGING_ONLY.sql');
 assert.match(sql,/alter table public\.v7_guardian_links enable row level security/);
 assert.match(sql,/alter table public\.v7_guardian_link_history enable row level security/);
 assert.match(sql,/create policy v7_guardian_teacher_select/);
 assert.match(sql,/c\.owner_id=\(select auth\.uid\(\)\)/);
 assert.match(sql,/revoke all on public\.v7_guardian_links,public\.v7_guardian_link_history from public,anon,authenticated/);
 assert.doesNotMatch(sql,/grant (insert|update|delete|all) on public\.v7_guardian_links/i);
});
test('isolated PostgreSQL contract tests guardian verification and unauthorized cadre access',()=>{
 const workflow=read('.github/workflows/alpha47-postgres-contract.yml');
 const pg=read('tests/postgres/guardian-links-lifecycle.sql');
 const rollback=read('sql/v7_guardian_links_STAGING_ONLY_ROLLBACK.sql');
 assert.match(workflow,/v7_guardian_links_STAGING_ONLY\.sql/);
 assert.match(workflow,/guardian-links-lifecycle\.sql/);
 assert.match(workflow,/v7_guardian_links_STAGING_ONLY_ROLLBACK\.sql/);
 for(const text of ['guardian idempotency mismatch','guardian deactivation failed','delegate can enumerate family phones','direct UPDATE on guardian contact allowed'])assert.ok(pg.includes(text));
 assert.match(rollback,/drop table if exists public\.v7_guardian_links/);
});
test('UI is owner-scoped, phone is masked by default and preview has no guardian data',()=>{
 const app=read('src/App.tsx');
 const panel=read('src/components/GuardianLinksPanel.tsx');
 const preview=read('src/components/SafePreviewWorkspace.tsx');
 const dossier=read('src/components/StudentDossierPanel.tsx');
 assert.match(app,/studentTab==='guardians'&&<GuardianLinksPanel/);
 assert.match(app,/canWrite=\{canWrite\}/);
 assert.match(dossier,/onOpenGuardians/);
 assert.match(panel,/maskGuardianPhone\(item\.contact_phone\)/);
 assert.match(panel,/不代表家长已注册系统账号/);
 assert.match(panel,/已核实/);
 assert.match(preview,/tab==='guardians'/);
 assert.match(preview,/不会猜测家长身份/);
 assert.doesNotMatch(preview,/fakeGuardian|\.rpc\('v7_create_guardian_link'/);
});
test('student dossier displays six metadata-only categories, not private family conversations',()=>{
 const adapter=read('src/lib/supabase-readonly-adapter.mjs');
 const dossier=read('src/components/StudentDossierPanel.tsx');
 assert.match(adapter,/'家校沟通':\{table:'family_contacts',fields:'id,contacted_on,method,created_at'/);
 assert.doesNotMatch(adapter,/'家校沟通':\{[^\n]*(summary|followup|phone)/);
 assert.match(dossier,/dossier-growth-summary/);
 assert.match(dossier,/家校沟通/);
});
