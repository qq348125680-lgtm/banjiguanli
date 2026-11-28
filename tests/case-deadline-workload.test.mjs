import test from 'node:test';
import assert from 'node:assert/strict';
import {schoolToday,validateSchoolDate,addSchoolDays,dueReminderDefinitions,dateMatchesBucket,verifyDueResponse,verifyWorkloadRows} from '../src/lib/case-deadline-model.mjs';
import {createEventCaseApi,validateDeadlineMutation,CASE_STATES,CASE_KINDS} from '../src/lib/event-case-api.mjs';
const cls='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',teacher='11111111-1111-4111-8111-111111111111',cadre='33333333-3333-4333-8333-333333333333',student='aaaaaaaa-0000-4000-8000-000000000001',caseId='99999999-9999-4999-8999-999999999999';
test('school dates use Asia/Shanghai midnight and cross leap months and year boundaries',()=>{
 assert.equal(schoolToday(new Date('2026-11-28T15:59:59Z')),'2026-11-28');
 assert.equal(schoolToday(new Date('2026-11-28T16:00:00Z')),'2026-11-29');
 assert.equal(addSchoolDays('2026-12-30',3),'2027-01-02');
 assert.equal(addSchoolDays('2028-02-28',1),'2028-02-29');
 assert.equal(addSchoolDays('2028-02-29',1),'2028-03-01');
 for(const d of ['2026-02-29','2026-13-01','2026-00-10','2026-11-31','invalid'])assert.throws(()=>validateSchoolDate(d));
 assert.equal(validateSchoolDate(null,true),null);
});
test('three deadline buckets are disjoint; closed and unset must not be counted',()=>{
 const buckets=dueReminderDefinitions('2026-11-29');
 assert.deepEqual(buckets.map(x=>x.id),['overdue','today','soon']);
 const expected={'2026-11-28':'overdue','2026-11-29':'today','2026-11-30':'soon','2026-12-02':'soon'};
 for(const [date,group] of Object.entries(expected)){
  assert.deepEqual(buckets.filter(b=>dateMatchesBucket(date,b)).map(x=>x.id),[group]);
 }
 assert.deepEqual(buckets.filter(b=>dateMatchesBucket('2026-12-03',b)),[]);
 const row={id:caseId,class_id:cls,student_id:student,kind:'考勤',title:'到期事项',status:'处理中',assigned_to:cadre,due_on:'2026-11-28'};
 const bucket=buckets[0];
 const g=verifyDueResponse({data:[row],count:5,error:null},bucket,cls,cadre);
 assert.equal(g.count,5);assert.equal(g.items[0].dueOn,'2026-11-28');
 assert.throws(()=>verifyDueResponse({data:[{...row,status:'已结案'}],count:1,error:null},bucket,cls,cadre));
 assert.throws(()=>verifyDueResponse({data:[{...row,due_on:null}],count:1,error:null},bucket,cls,cadre));
 assert.throws(()=>verifyDueResponse({data:[{...row,assigned_to:teacher}],count:1,error:null},bucket,cls,cadre));
 assert.throws(()=>verifyDueResponse({data:[],count:null,error:null},bucket,cls,cadre));
 assert.throws(()=>verifyDueResponse({data:[],count:0,error:{code:'42501'}},bucket,cls,cadre));
});
test('deadline mutation validates expected state, date and mandatory reason',()=>{
 assert.deepEqual(validateDeadlineMutation(caseId,'2026-12-05',null,' 本周完成 '),{
  p_case_id:caseId,p_due_on:'2026-12-05',p_expected_due_on:null,p_note:'本周完成'});
 assert.equal(validateDeadlineMutation(caseId,null,'2026-12-05','取消理由').p_due_on,null);
 for(const [id,due,expected,note] of [
  ['invalid','2026-12-05',null,'理由'],[caseId,'2026-02-31',null,'理由'],
  [caseId,null,'bad','理由'],[caseId,'2026-12-05',null,''],
  [caseId,'2026-12-05',null,'x'.repeat(501)]
 ])assert.throws(()=>validateDeadlineMutation(id,due,expected,note));
});
test('status and category aggregates must agree; missing categories are zero only after complete RPC result',()=>{
 const rows=[
  {dimension:'status',item:'处理中',amount:'3'}, {dimension:'status',item:'已结案',amount:2},
  {dimension:'kind',item:'违纪',amount:2},{dimension:'kind',item:'值日',amount:3},
  {dimension:'assignee',item:cadre,amount:2},{dimension:'assignee',item:teacher,amount:1}
 ];
 const result=verifyWorkloadRows(rows,CASE_STATES,CASE_KINDS);
 assert.equal(result.total,5);assert.equal(result.open,3);
 assert.equal(result.kind['考勤'],0);
 assert.equal(result.status['待复核'],0);
 assert.deepEqual(result.assignee,{[cadre]:2,[teacher]:1});
 assert.throws(()=>verifyWorkloadRows(rows.slice(0,4).concat({dimension:'kind',item:'值日',amount:1}),CASE_STATES,CASE_KINDS));
 assert.throws(()=>verifyWorkloadRows(rows.slice(0,3),CASE_STATES,CASE_KINDS));
 assert.throws(()=>verifyWorkloadRows([{dimension:'unknown',item:'hello',amount:1}],CASE_STATES,CASE_KINDS));
 assert.throws(()=>verifyWorkloadRows(null,CASE_STATES,CASE_KINDS));
});
function fake(role='teacher'){
 const calls=[],rpcCalls=[];
 const account=role==='teacher'?teacher:cadre;
 function from(table){
  const q={table,fields:'',options:{},clauses:[]};calls.push(q);
  const chain={
   select(fields,options){q.fields=fields;q.options=options??{};return chain},
   eq(k,v){q.clauses.push(['eq',k,v]);return chain},
   neq(k,v){q.clauses.push(['neq',k,v]);return chain},
   lt(k,v){q.clauses.push(['lt',k,v]);return chain},
   gt(k,v){q.clauses.push(['gt',k,v]);return chain},
   lte(k,v){q.clauses.push(['lte',k,v]);return chain},
   order(){return chain},
   limit(n){q.limit=n;return Promise.resolve({data:[],count:0,error:null})},
   maybeSingle(){return Promise.resolve({data:table==='classes'&&role==='teacher'?{id:cls}:table==='class_delegates'&&role==='cadre'?{id:caseId}:null,error:null})}
  };return chain;
 }
 const client={auth:{getUser:async()=>({data:{user:{id:account}},error:null})},from,rpc:async(name,params)=>{rpcCalls.push({name,params});return {data:name==='v7_set_case_deadline'?{id:caseId,status:'处理中',due_on:'2026-12-05'}:[],error:null}}};
 return {api:createEventCaseApi(client),calls,rpcCalls};
}
test('deadline digest queries exact count, never closed rows, and cadre only assigned tasks',async()=>{
 const own=fake('teacher');const a=await own.api.dueDigest(cls);
 assert.equal(a.groups.length,3);assert.equal(a.total,0);
 assert.ok(own.calls.filter(x=>x.table==='v7_event_cases').every(q=>q.clauses.some(([f,k,v])=>f==='neq'&&k==='status'&&v==='已结案')));
 const cad=fake('cadre');const b=await cad.api.dueDigest(cls);
 assert.equal(b.owned,false);
 assert.ok(cad.calls.filter(x=>x.table==='v7_event_cases').every(q=>q.clauses.some(([f,k,v])=>f==='eq'&&k==='assigned_to'&&v===cadre)));
 assert.ok(cad.calls.filter(x=>x.table==='v7_event_cases').every(q=>q.options.count==='exact'));
});
test('deadline mutation uses single server RPC and owner overview uses aggregate RPC',async()=>{
 const m=fake();
 assert.equal((await m.api.setDeadline(caseId,'2026-12-05',null,'教学回访安排')).due_on,'2026-12-05');
 assert.deepEqual(m.rpcCalls[0],{name:'v7_set_case_deadline',params:{
  p_case_id:caseId,p_due_on:'2026-12-05',p_expected_due_on:null,p_note:'教学回访安排'
 }});
 const aggregate=[
  {dimension:'status',item:'处理中',amount:1},
  {dimension:'kind',item:'考勤',amount:1}
 ];
 const client={auth:{getUser:async()=>({data:{user:{id:teacher}},error:null})},from(){throw Error('must not touch tables')},rpc:async()=>({data:aggregate,error:null})};
 const stats=await createEventCaseApi(client).classOverview(cls);
 assert.equal(stats.total,1);
});
