import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');

test('deadline migration permits owner changes only and keeps original case fields/history',()=>{
 const sql=read('sql/v7_case_deadlines_STAGING_ONLY.sql');
 assert.match(sql,/STAGING ONLY/);
 assert.match(sql,/alter table public\.v7_event_cases add column due_on date/);
 assert.match(sql,/previous_due_on date/);
 assert.match(sql,/next_due_on date/);
 assert.match(sql,/设置期限.*调整期限.*取消期限/);
 assert.match(sql,/v_case\.due_on is distinct from p_expected_due_on/);
 assert.match(sql,/select \* into v_case from public\.v7_event_cases where id=p_case_id for update/);
 assert.match(sql,/v_case\.status='已结案'/);
 assert.match(sql,/c\.owner_id=v_actor/);
 assert.doesNotMatch(sql,/\bupdate\s+public\.(attendance|incidents|point_events|family_contacts)/i);
});
test('deadline events are immutable to regular accounts and class stats omit private business details',()=>{
 const sql=read('sql/v7_case_deadlines_STAGING_ONLY.sql');
 assert.match(sql,/revoke all on function public\.v7_set_case_deadline/);
 assert.match(sql,/grant execute on function public\.v7_class_case_overview/);
 assert.match(sql,/where c\.class_id=p_class_id and c\.status<>'已结案'/);
 assert.match(sql,/returns table\(dimension text,item text,amount bigint\)/);
 assert.doesNotMatch(sql,/select .*contact_phone|phone_number|family_summary/i);
});
test('disposable PostgreSQL tests owner action, stale updates, no-op and cadre denial',()=>{
 const wf=read('.github/workflows/alpha47-postgres-contract.yml');
 const pg=read('tests/postgres/event-deadline-lifecycle.sql');
 const rollback=read('sql/v7_case_deadlines_STAGING_ONLY_ROLLBACK.sql');
 for(const f of ['v7_case_deadlines_STAGING_ONLY.sql','event-deadline-lifecycle.sql','v7_case_deadlines_STAGING_ONLY_ROLLBACK.sql'])
  assert.ok(wf.includes(f),f);
 for(const marker of ['deadline change history lacks old/new dates','stale deadline overwrote another update','delegate modified deadline','closed case deadline changed','class status overview should cover two cases'])
  assert.ok(pg.includes(marker),marker);
 assert.match(rollback,/Do NOT use this as a standalone rollback on a populated real project/);
 assert.doesNotMatch(rollback,/\bdrop column\b|delete from public\.v7_event_case_history/i);
});
test('work order UI exposes old/new deadline dates and requires edit reason, no browser SQL',()=>{
 const panel=read('src/components/EventCaseBoard.tsx');
 const api=read('src/lib/event-case-api.mjs');
 assert.match(panel,/type="date"/);
 assert.match(panel,/设置期限/);
 assert.match(panel,/取消期限/);
 assert.match(panel,/期限调整说明/);
 assert.match(panel,/h\.previous_due_on/);
 assert.match(panel,/h\.next_due_on/);
 assert.match(panel,/row\.status!=='已结案'/);
 assert.match(api,/v7_set_case_deadline/);
 assert.match(api,/v7_class_case_overview/);
 assert.match(api,/dueDigest/);
 assert.doesNotMatch(panel,/\.insert\(|\.delete\(|\.update\(/);
});
test('homepage and reports respect roles and route to existing case workflow',()=>{
 const app=read('src/App.tsx');
 const reminders=read('src/components/CaseDueReminderPanel.tsx');
 const stats=read('src/components/ClassCaseOverviewPanel.tsx');
 const preview=read('src/components/SafePreviewWorkspace.tsx');
 assert.match(app,/<CaseDueReminderPanel key=/);
 assert.match(app,/load=\{fetchDueDigest\}/);
 assert.match(app,/owned&&<><ClassCaseOverviewPanel/);
 assert.match(app,/onStatus=\{openCasesByStatus\}/);
 assert.match(app,/initialStatus=\{caseFilterStatus\}/);
 assert.match(reminders,/到期提醒读取失败/);
 assert.match(stats,/负责人在办工作量/);
 assert.match(preview,/<CaseDeadlinePreview\/>/);
 assert.match(preview,/<CaseOverviewPreview\/>/);
});
