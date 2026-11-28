import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('assignee transfer is distinct from initial assignment and must explain why',()=>{
 const migration=read('sql/v7_event_cases_STAGING_ONLY.sql');
 assert.match(migration,/action text not null check\(action in \('创建','指派','转派'/);
 assert.match(migration,/previous_assignee uuid/);
 assert.match(migration,/next_assignee uuid/);
 assert.match(migration,/v_case\.assigned_to=p_assignee/);
 assert.match(migration,/转派工单必须填写原因/);
 assert.match(migration,/v_name:=case when v_case\.assigned_to is null then '指派' else '转派' end/);
 assert.match(migration,/v_case\.assigned_to,case when p_action='assign' then p_assignee else v_case\.assigned_to end/);
});
test('postgres lifecycle covers repeated/no-reason reassignment and before-after account proof',()=>{
 const pg=read('tests/postgres/event-case-lifecycle.sql');
 assert.match(pg,/identical assignment unexpectedly allowed/);
 assert.match(pg,/reassignment without reason unexpectedly allowed/);
 assert.match(pg,/action='转派' and previous_assignee=/);
 assert.match(pg,/next_assignee='66666666-6666-4666-8666-666666666666'/);
 assert.match(pg,/if n<>7 then raise exception 'event history expected 7/);
});
test('owner UI shows transfer reason field and old/new identities, no direct table writes',()=>{
 const panel=read('src/components/EventCaseBoard.tsx');
 const api=read('src/lib/event-case-api.mjs');
 assert.match(panel,/确认转派/);
 assert.match(panel,/转派原因（必填）/);
 assert.match(panel,/case-transfer-detail/);
 assert.match(panel,/displayActor\(h\.previous_assignee\)/);
 assert.match(panel,/displayActor\(h\.next_assignee\)/);
 assert.match(panel,/candidate===row\.assigned_to/);
 assert.match(api,/previous_assignee,next_assignee,note,created_at/);
 assert.doesNotMatch(panel,/\.update\(|\.delete\(|\.insert\(/);
});
test('six-category owner student dossier includes bounded family contact metadata only',()=>{
 const component=read('src/components/StudentDossierPanel.tsx');
 const app=read('src/App.tsx');
 const adapter=read('src/lib/supabase-readonly-adapter.mjs');
 assert.match(component,/SECTIONS=\['考勤','请假','违纪','积分','值日','家校沟通'\]/);
 assert.match(component,/dossier-growth-summary/);
 assert.match(component,/onCount=\{captureCount\}/);
 assert.match(component,/item\.contacted_on/);
 assert.match(app,/section:'考勤'\|'请假'\|'违纪'\|'积分'\|'值日'\|'家校沟通'/);
 assert.match(adapter,/'家校沟通':\{table:'family_contacts',fields:'id,contacted_on,method,created_at',order:'contacted_on'\}/);
 assert.doesNotMatch(adapter,/'家校沟通':\{[^\n]*(summary|followup|guardian|phone)/);
});
