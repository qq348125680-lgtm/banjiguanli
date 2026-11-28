import test from 'node:test';
import assert from 'node:assert/strict';
import {createEventCaseApi,validateCaseInput,validateCaseTransition,CASE_STATES} from '../src/lib/event-case-api.mjs';
const classId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const studentId='aaaaaaaa-0000-4000-8000-000000000001';
const caseId='77777777-7777-4777-8777-777777777777';
const requestKey='99999999-9999-4999-8999-999999999999';
test('event creation validates scoped student, type, length and stable idempotency key',()=>{
 const input={classId,studentId,kind:'违纪',title:' 课堂纪律 ',description:'用于核对',requestKey};
 const normalized=validateCaseInput(input);
 assert.equal(normalized.p_title,'课堂纪律');
 assert.equal(normalized.p_request_key,requestKey);
 for(const change of [
  {classId:'other'}, {studentId:'BAD'}, {kind:'学籍'}, {title:'a'},
  {title:'x'.repeat(81)},{description:'a'.repeat(1001)},{requestKey:'invalid'}
 ])assert.throws(()=>validateCaseInput({...input,...change}));
});
test('event transition enforces action whitelist, assignee and meaningful feedback',()=>{
 assert.equal(validateCaseTransition(caseId,'assign',studentId,'').p_assignee,studentId);
 assert.equal(validateCaseTransition(caseId,'reply',null,' 核实完成 ').p_note,'核实完成');
 assert.throws(()=>validateCaseTransition(caseId,'approve',null,'hello'));
 assert.throws(()=>validateCaseTransition(caseId,'assign',null,''));
 assert.throws(()=>validateCaseTransition(caseId,'close',null,''));
 assert.throws(()=>validateCaseTransition(caseId,'reopen',null,' '.repeat(4)));
 assert.deepEqual(CASE_STATES,['待分派','处理中','待复核','已结案']);
});
function fake({role='owner',rpcResult=caseId,rpcError=null}={}){
 const calls=[];
 const userId=role==='owner'?'11111111-1111-4111-8111-111111111111':'33333333-3333-4333-8333-333333333333';
 function from(table){
  const query={table,ops:[]};
  const chain={
   select(fields,opts){query.ops.push(['select',fields,opts]);return chain},
   eq(k,v){query.ops.push(['eq',k,v]);return chain},
   order(k,opts){query.ops.push(['order',k,opts]);return chain},
   range(a,b){query.ops.push(['range',a,b]);return Promise.resolve({data:[],count:0,error:null})},
   limit(n){query.ops.push(['limit',n]);return Promise.resolve({data:[],error:null})},
   maybeSingle(){calls.push(query);return Promise.resolve({data:null,error:null})}
  };calls.push(query);return chain;
 }
 const client={auth:{getUser:async()=>({data:{user:{id:userId}},error:null})},from,
  rpc:async(name,params)=>{calls.push({rpc:name,params});return {data:rpcResult,error:rpcError}}};
 return {api:createEventCaseApi(client),calls};
}
test('Supabase case API sends only reviewed RPC signatures and passes idempotency token',async()=>{
 const {api,calls}=fake();
 const id=await api.create({classId,studentId,kind:'考勤',title:'今日异常考勤',description:'',requestKey});
 assert.equal(id,caseId);
 assert.deepEqual(calls.find(c=>c.rpc==='v7_create_event_case').params,{
  p_class_id:classId,p_student_id:studentId,p_kind:'考勤',p_title:'今日异常考勤',p_description:'',p_request_key:requestKey
 });
 await assert.rejects(()=>api.transition(caseId,'close',null,'已复核完毕'),/未能核实/);
 const transition=calls.find(c=>c.rpc==='v7_transition_event_case');
 assert.equal(transition.params.p_action,'close');
 assert.equal(transition.params.p_case_id,caseId);
});
test('event case list is class-filtered, page-limited, and respects requested status',async()=>{
 const {api,calls}=fake();
 const result=await api.list(classId,{page:2,pageSize:10,status:'处理中'});
 assert.equal(result.count,0);
 assert.ok(calls.some(c=>c.table==='v7_event_cases'&&c.ops.some(o=>o[0]==='eq'&&o[1]==='class_id'&&o[2]===classId)));
 assert.ok(calls.find(c=>c.table==='v7_event_cases').ops.some(o=>o[0]==='range'&&o[1]===10&&o[2]===19));
 await assert.rejects(()=>api.list(classId,{page:0,pageSize:10,status:'全部'}));
 await assert.rejects(()=>api.list(classId,{page:1,pageSize:100,status:'全部'}));
 await assert.rejects(()=>api.list(classId,{page:1,pageSize:10,status:'我想看所有'}));
});
test('event reconciliation queries server by original UUID and authenticated creator',async()=>{
 const {api,calls}=fake();
 const result=await api.findByRequestKey(classId,requestKey);
 assert.equal(result,null);
 const q=calls.find(c=>c.table==='v7_event_cases');
 assert.ok(q.ops.some(o=>o[0]==='eq'&&o[1]==='request_key'&&o[2]===requestKey));
 assert.ok(q.ops.some(o=>o[0]==='eq'&&o[1]==='created_by'));
});
test('RPC rejects failed server outcomes and invalid mutation outputs',async()=>{
 const {api}=fake({rpcError:{code:'42501',message:'denied'}});
 await assert.rejects(()=>api.create({classId,studentId,kind:'值日',title:'卫生问题',requestKey}));
 const valid=fake({rpcResult:{id:caseId,status:'处理中'}});
 assert.equal((await valid.api.transition(caseId,'assign',studentId,'')).status,'处理中');
});

test('assignee choices use verified owner-only RPC, never raw delegates table SELECT',async()=>{
 const userId='11111111-1111-4111-8111-111111111111';
 const calls=[];
 const api=createEventCaseApi({
  auth:{getUser:async()=>({data:{user:{id:userId}},error:null})},
  from:()=>{throw Error('assignee list must not directly read tables')},
  rpc:async(name,params)=>{
   calls.push({name,params});
   if(name==='v7_event_case_assignees')return {data:[
    {user_id:userId,student_id:null,duty:'班主任（本人）',enabled:true},
    {user_id:'33333333-3333-4333-8333-333333333333',student_id:studentId,duty:'班长',enabled:true},
    {user_id:'44444444-4444-4444-8444-444444444444',student_id:null,duty:'停用',enabled:false}
   ],error:null};
   throw Error('unexpected RPC');
  }
 });
 const people=await api.assignees(classId);
 assert.deepEqual(people.map(p=>p.duty),['班主任（本人）','班长']);
 assert.deepEqual(calls,[{name:'v7_event_case_assignees',params:{p_class_id:classId}}]);
});
