import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const text=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('new event tables are isolated staging-only with role-controlled selects and RPC writes',()=>{
 const sql=text('sql/v7_event_cases_STAGING_ONLY.sql');
 assert.match(sql,/STAGING ONLY/);
 for(const marker of ['create table public.v7_event_cases','create table public.v7_event_case_history','request_key uuid not null','alter table public.v7_event_cases enable row level security','alter table public.v7_event_case_history enable row level security','create policy v7_event_case_select','create policy v7_event_history_select','for update','v7_create_event_case','v7_transition_event_case','grant execute on function']){
  assert.ok(sql.includes(marker),'missing '+marker);
 }
 assert.match(sql,/on conflict\(class_id,request_key\) do nothing/);
 assert.match(sql,/v_case\.status<>'已结案'/);
 assert.match(sql,/to authenticated/);
 assert.doesNotMatch(sql,/grant (insert|update|delete|all) on public\.v7_event_cases to authenticated/i);
});
test('event case board uses existing class account scope and respects write toggle',()=>{
 const app=text('src/App.tsx'),panel=text('src/components/EventCaseBoard.tsx'),bridge=text('src/lib/bridge.ts');
 assert.match(bridge,/cases:createEventCaseApi\(client\)/);
 assert.match(app,/recordTab==='cases'&&<EventCaseBoard/);
 assert.match(app,/canWrite=\{canWrite\}/);
 assert.match(panel,/canWrite&&<form/);
 assert.match(panel,/onClick=\{\(\)=>void verify\(\)\}/);
 assert.match(panel,/api\.findByRequestKey/);
 assert.match(panel,/api\.transition/);
 assert.match(panel,/case-history/);
 assert.doesNotMatch(panel,/\.insert\(|\.update\(|\.delete\(/);
});
test('Postgres integration workflow covers complete state transitions and rollback',()=>{
 const workflow=text('.github/workflows/alpha47-postgres-contract.yml');
 assert.match(workflow,/event-case-lifecycle\.sql/);
 assert.match(workflow,/v7_event_cases_STAGING_ONLY\.sql/);
 assert.match(workflow,/v7_event_cases_STAGING_ONLY_ROLLBACK\.sql/);
 const sql=text('tests/postgres/event-case-lifecycle.sql');
 for(const action of ["'assign'","'reply'","'close'","'reopen'"])assert.ok(sql.includes(action));
});
