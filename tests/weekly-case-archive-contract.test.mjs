import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('weekly aggregates use exact server-side audit rows and teacher authorization, no direct school record mutation',()=>{
 const sql=read('sql/v7_weekly_case_report_STAGING_ONLY.sql');
 assert.match(sql,/STAGING ONLY/);
 assert.match(sql,/public\.v7_weekly_case_report\(p_class_id uuid,p_week_start date\)/);
 assert.match(sql,/c\.owner_id=v_actor/);
 assert.match(sql,/extract\(isodow from p_week_start\)<>1/);
 assert.match(sql,/p_week_start::timestamp at time zone 'Asia\/Shanghai'/);
 assert.match(sql,/\(p_week_start\+7\)::timestamp at time zone 'Asia\/Shanghai'/);
 assert.match(sql,/join public\.v7_event_cases c on c\.id=h\.case_id/);
 assert.match(sql,/h\.action='结案'/);
 assert.match(sql,/revoke all on function public\.v7_weekly_case_report/);
 assert.doesNotMatch(sql,/\b(UPDATE|DELETE|INSERT|TRUNCATE)\s+(?:INTO\s+|FROM\s+)?public\.(?:attendance|incidents|family_contacts)/i);
});
test('weekly SQL has real synthetic PostgreSQL regression with family follow-ups and access denial',()=>{
 const workflow=read('.github/workflows/alpha47-postgres-contract.yml');
 const fixture=read('tests/postgres/weekly-case-report.sql');
 const rollback=read('sql/v7_weekly_case_report_STAGING_ONLY_ROLLBACK.sql');
 for(const name of ['v7_weekly_case_report_STAGING_ONLY.sql','weekly-case-report.sql','v7_weekly_case_report_STAGING_ONLY_ROLLBACK.sql'])
  assert.ok(workflow.includes(name),name);
 for(const term of ['weekly created category totals mismatch','family follow-up total incorrect',
  'cadre accessed complete class weekly report','cross-class owner accessed unrelated weekly report','non-Monday accepted'])
  assert.ok(fixture.includes(term),term);
 assert.match(rollback,/drop function if exists public\.v7_weekly_case_report/);
 assert.doesNotMatch(rollback,/drop table|delete from|update public/i);
});
test('work reports expose truthful result, user-directed copy and local TXT download',()=>{
 const panel=read('src/components/WeeklyCaseReportPanel.tsx');
 const model=read('src/lib/class-weekly-case-report.mjs');
 assert.match(panel,/weekMonday\(/);
 assert.match(panel,/verifyWeeklyRows\(rows\)/);
 assert.match(panel,/本周新建工单/);
 assert.match(panel,/家校跟进新建/);
 assert.match(panel,/复制周报正文/);
 assert.match(panel,/下载周报 TXT/);
 assert.match(panel,/navigator\.clipboard\.writeText\(report\)/);
 assert.match(panel,/new Blob\(/);
 assert.match(panel,/本周创建的工单/);
 assert.match(model,/不含学生姓名、监护人电话或谈话正文/);
 assert.doesNotMatch(panel,/fakeStudent|mockedRows|\.insert\(|\.update\(/);
});
test('closed case archives server page, teacher only, jump back to original case',()=>{
 const app=read('src/App.tsx');
 const panel=read('src/components/ClosedCaseArchivePanel.tsx');
 const api=read('src/lib/event-case-api.mjs');
 assert.match(app,/view==='archive'&&owned&&<><ClosedCaseArchivePanel/);
 assert.match(app,/load=\{fetchClosedCaseArchive\}/);
 assert.match(app,/view==='reports'&&<><ReportsPanel/);
 assert.match(app,/<WeeklyCaseReportPanel key=/);
 assert.match(panel,/只看家校沟通结案/);
 assert.match(panel,/onOpen\(item\.id\)/);
 assert.match(panel,/结案开始日期/);
 assert.match(panel,/结案结束日期/);
 assert.match(api,/async function closedArchive\(/);
 assert.match(api,/\.eq\('class_id',classId\)\.eq\('status','已结案'\)/);
 assert.match(api,/\.range\(\(page-1\)\*pageSize,page\*pageSize-1\)/);
 assert.match(api,/当前账号不是该班班主任/);
});
test('public preview does not expose student names or invented report figures',()=>{
 const preview=read('src/components/WeeklyCaseArchivePreview.tsx');
 const parent=read('src/components/SafePreviewWorkspace.tsx');
 assert.match(parent,/<WeeklyCaseArchivePreview\/>/);
 assert.match(preview,/不带学生隐私/);
 assert.match(preview,/无数据预览/);
 assert.doesNotMatch(preview,/\.rpc\(|\.from\(|\.insert\(|\.update\(|真实学生姓名|138\d{8}/);
});
