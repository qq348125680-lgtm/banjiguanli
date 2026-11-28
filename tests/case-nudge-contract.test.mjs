import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('催办是在工单之上的持久化补充，禁止更改旧班务表',()=>{
 const sql=read('sql/v7_case_nudges_STAGING_ONLY.sql');
 assert.match(sql,/STAGING ONLY/);
 assert.match(sql,/create table public\.v7_case_nudges/);
 assert.match(sql,/case_id uuid not null references public\.v7_event_cases\(id\)/);
 assert.match(sql,/create unique index v7_case_one_active_nudge/);
 assert.match(sql,/where resolved_at is null/);
 assert.match(sql,/check\(action in \('创建'.*'催办'\)/);
 assert.match(sql,/create or replace function public\.v7_send_case_nudge/);
 assert.match(sql,/create trigger v7_case_resolve_nudge/);
 assert.doesNotMatch(sql,/\bupdate\s+public\.(attendance|leave_requests|incidents|point_events|duty_assignments|family_contacts)/i);
});
test('班主任身份和截止日、负责人、次数必须由数据库验证',()=>{
 const sql=read('sql/v7_case_nudges_STAGING_ONLY.sql');
 assert.match(sql,/c\.owner_id=v_actor/);
 assert.match(sql,/v_case\.status<>'处理中'/);
 assert.match(sql,/v_case\.due_on is null/);
 assert.match(sql,/Asia\/Shanghai/);
 assert.match(sql,/今天已催办过/);
 assert.match(sql,/原负责人已停用/);
 assert.match(sql,/where id=p_case_id for update/);
 assert.match(sql,/revoke all on function public\.v7_send_case_nudge/);
 assert.match(sql,/grant execute on function public\.v7_send_case_nudge\(uuid,text\) to authenticated/);
});
test('催办到反馈或转派的状态变更只清理待回应标记，不删流水',()=>{
 const sql=read('sql/v7_case_nudges_STAGING_ONLY.sql');
 assert.match(sql,/old\.assigned_to is distinct from new\.assigned_to/);
 assert.match(sql,/old\.status='处理中' and new\.status<>'处理中'/);
 assert.match(sql,/resolved_reason=v_reason/);
 assert.match(sql,/resolved_at=clock_timestamp\(\)/);
 assert.doesNotMatch(sql,/delete from public\.v7_event_case_history/i);
 assert.doesNotMatch(sql,/delete from public\.v7_case_nudges/i);
});
test('临时 PostgreSQL 验证班主任催办、干部反馈、转派、禁用身份和回滚',()=>{
 const flow=read('.github/workflows/alpha47-postgres-contract.yml');
 const pg=read('tests/postgres/case-nudge-lifecycle.sql');
 const rb=read('sql/v7_case_nudges_STAGING_ONLY_ROLLBACK.sql');
 for(const f of ['v7_case_nudges_STAGING_ONLY.sql','case-nudge-lifecycle.sql','v7_case_nudges_STAGING_ONLY_ROLLBACK.sql'])assert.ok(flow.includes(f));
 for(const phrase of ['same-day repeated nudge allowed','cadre feedback did not resolve their pending nudge','reassignment did not resolve previous cadre nudge','cross-class owner saw private reminders'])assert.ok(pg.includes(phrase));
 assert.match(rb,/Do not run against a populated production database/);
 assert.doesNotMatch(rb,/delete from public\.v7_event_case_history/i);
});
test('手机端班主任可催办而班干部通过原工单提交反馈',()=>{
 const app=read('src/App.tsx');
 const panel=read('src/components/EventCaseBoard.tsx');
 const inbox=read('src/components/CaseNudgeInboxPanel.tsx');
 const preview=read('src/components/SafePreviewWorkspace.tsx');
 assert.match(app,/load=\{fetchPendingNudges\}/);
 assert.match(app,/<CaseNudgeInboxPanel/);
 assert.match(panel,/催办负责人/);
 assert.match(panel,/canWrite&&owned&&row\.status==='处理中'/);
 assert.match(panel,/api\.sendNudge\(row\.id,note\)/);
 assert.match(panel,/提交处理反馈/);
 assert.match(inbox,/data\.owned\?'查看跟进':'立即反馈'/);
 assert.match(inbox,/待反馈/);
 assert.match(preview,/<CaseNudgeInboxPreview\/>/);
 assert.doesNotMatch(panel,/\.update\(|\.insert\(|\.delete\(/);
});
