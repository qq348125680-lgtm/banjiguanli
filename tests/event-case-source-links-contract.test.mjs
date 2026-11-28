import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('source-link migration never edits original attendance/leave/incident/contact records',()=>{
 const sql=read('sql/v7_case_source_links_STAGING_ONLY.sql');
 assert.match(sql,/STAGING ONLY/);
 assert.match(sql,/create table public\.v7_event_case_sources/);
 assert.match(sql,/unique\(class_id,source_kind,source_record_id\)/);
 assert.match(sql,/v7_create_linked_event_case/);
 assert.match(sql,/p_student_id uuid/);
 assert.match(sql,/select exists\(select 1 from public\.%I where id=\$1 and student_id=\$2/);
 assert.match(sql,/v_case:=public\.v7_create_event_case/);
 assert.match(sql,/on conflict do nothing/);
 assert.match(sql,/create policy v7_event_source_teacher/);
 assert.doesNotMatch(sql,/\b(update|delete|alter|truncate)\s+public\.(attendance|leave_requests|incidents|point_events|duty_assignments|family_contacts)/i);
});
test('source links are owner-only and never expose family contact rows to cadre',()=>{
 const sql=read('sql/v7_case_source_links_STAGING_ONLY.sql');
 assert.match(sql,/revoke all on public\.v7_event_case_sources from public,anon,authenticated/);
 assert.match(sql,/c\.owner_id=\(select auth\.uid\(\)\)/);
 assert.match(sql,/只有本班班主任可关联原始业务记录/);
 assert.match(sql,/grant execute on function public\.v7_create_linked_event_case/);
 assert.doesNotMatch(sql,/grant (insert|update|delete|all) on public\.v7_event_case_sources to authenticated/i);
});
test('isolated PG verification covers six sources, duplicates, access boundaries and rollback cleanup',()=>{
 const wf=read('.github/workflows/alpha47-postgres-contract.yml');
 const pg=read('tests/postgres/event-source-link-lifecycle.sql');
 const cleanup=read('tests/postgres/source-record-fixtures-cleanup.sql');
 for(const file of ['source-record-fixtures.sql','v7_case_source_links_STAGING_ONLY.sql','event-source-link-lifecycle.sql','v7_case_source_links_STAGING_ONLY_ROLLBACK.sql','source-record-fixtures-cleanup.sql'])
  assert.ok(wf.includes(file),file);
 assert.match(pg,/expected six linked original-record categories/);
 assert.match(pg,/same original attendance accepted two cases/);
 assert.match(pg,/cross-student attendance linked/);
 assert.match(pg,/cadre can inspect owner-only source link identifiers/);
 assert.match(cleanup,/delete from public\.attendance where id in/);
});
test('event center cannot treat failed link query as no existing work orders',()=>{
 const app=read('src/App.tsx');
 const panel=read('src/components/EventCenterPanel.tsx');
 assert.match(app,/linksAvailable:false/);
 assert.match(app,/bridges\.cases\.sourceLinks\(classId,feed\.events\)/);
 assert.match(panel,/feed\?\.linksAvailable===false/);
 assert.match(panel,/item\.linkedCaseId&&onOpenCase/);
 assert.match(panel,/feed\?\.linksAvailable===true&&onCreateCase/);
});
test('growth dossier uses exact server-side student case counts without double-counting original events',()=>{
 const panel=read('src/components/StudentDossierPanel.tsx');
 const api=read('src/lib/event-case-api.mjs');
 const app=read('src/App.tsx');
 assert.match(api,/async function studentSummary\(classId,studentId\)/);
 assert.match(api,/count:'exact',head:true/);
 assert.match(api,/\.eq\('student_id',studentId\)\.eq\('status',status\)/);
 assert.match(panel,/CASE_LABELS=\['待分派','处理中','待复核','已结案'\]/);
 assert.match(panel,/不能将两者相加当作独立事件总数/);
 assert.match(app,/fetchCaseSummary=\{fetchDossierCaseSummary\}/);
});
