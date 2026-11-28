import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSafeWorkflow} from '../src/lib/safe-workflow.mjs';
import {uncertainWriteOutcome} from '../src/lib/domain.mjs';
import {withUncertainWriteDeadline} from '../src/lib/write-deadline.mjs';
const cid='11111111-1111-4111-8111-111111111111';
const sid='22222222-2222-4222-8222-222222222222';
const uid='33333333-3333-4333-8333-333333333333';
const current='2026-11-28';
function fakeClient({rows=[],error=null,uidValue=uid}={}){
 const calls=[];
 const client={
  auth:{getUser:async()=>({data:{user:{id:uidValue}},error:null})},
  rpc:async(name,args)=>({data:name==='v7_cadre_roster'?[{student_id:sid}]:{},error:null}),
  from(table){
   const filters=[];
   const q={
    select(columns){filters.push(['select',columns]);return q},
    eq(field,value){filters.push(['eq',field,value]);return q},
    order(field,opts){filters.push(['order',field]);return q},
    limit(n){filters.push(['limit',n]);calls.push({table,filters});return Promise.resolve({data:rows,error})}
   };
   return q;
  }
 };
 return {client,calls};
}
test('Alpha46 verification is read-only, exactly scopes current user, class, student and date',async()=>{
 const {client,calls}=fakeClient({rows:[{student_id:sid,occurred_on:current,entry_type:'考勤',status:'待审核',id:'abc'}]});
 const records=await createSafeWorkflow(client).verifySubmission({classId:cid,studentId:sid,date:current});
 assert.equal(records.length,1);
 assert.equal(calls.length,1);
 assert.equal(calls[0].table,'cadre_submissions');
 assert.ok(calls[0].filters.some(([op,k,v])=>op==='eq'&&k==='submitted_by'&&v===uid));
 assert.ok(calls[0].filters.some(([op,k,v])=>op==='eq'&&k==='student_id'&&v===sid));
 assert.ok(calls[0].filters.some(([op,k,v])=>op==='eq'&&k==='class_id'&&v===cid));
 assert.ok(calls[0].filters.some(([op,k,v])=>op==='eq'&&k==='occurred_on'&&v===current));
 assert.ok(!calls[0].filters.some(([op])=>op==='insert'||op==='update'||op==='delete'));
});
test('Alpha46 verification rejects malformed date and preserves server read error',async()=>{
 const o=fakeClient({error:{message:'permission denied',code:'42501'}});
 await assert.rejects(()=>createSafeWorkflow(o.client).verifySubmission({classId:cid,studentId:sid,date:current}));
 await assert.rejects(()=>createSafeWorkflow(o.client).verifySubmission({classId:cid,studentId:sid,date:'2026-02-30'}),/日期/);
});
test('Alpha46 uncertain write errors do not trigger automatic duplicate attempts',()=>{
 assert.equal(uncertainWriteOutcome({code:'23505'}),false);
 assert.equal(uncertainWriteOutcome({code:'42501'}),false);
 assert.equal(uncertainWriteOutcome({code:'23514'}),false);
 assert.equal(uncertainWriteOutcome({message:'NetworkError'}),true);
 assert.equal(uncertainWriteOutcome({code:'503',message:'service unavailable'}),true);
 assert.equal(uncertainWriteOutcome(new Error('fetch failed')),true);
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 assert.match(app,/setUncertainSubmit\(\{accountId:submittedAccount,classId:submittedClass,day:submittedDay,studentId:submittedStudent\}\)/);
 assert.match(app,/async function reconcileUncertainSubmission\(/);
 assert.match(app,/setSubmittedSession\(prev=>markSubmissionConfirmed\(prev,pending.studentId\)\)/);
 assert.match(app,/当前页面继续锁定本次提交/);
 const panel=readFileSync(new URL('../src/components/AttendanceEntryPanel.tsx',import.meta.url),'utf8');
 assert.match(panel,/p.uncertainStudentId!==p.selected/);
 assert.match(panel,/核对提交结果/);
});
test('Alpha46 staging schema blocks duplicate pending submissions without removing old policies',()=>{
 const sql=readFileSync(new URL('../sql/alpha45_STAGING_ONLY_SAFE_MIGRATION.sql',import.meta.url),'utf8');
 const pre=readFileSync(new URL('../sql/alpha45_PREFLIGHT_READONLY.sql',import.meta.url),'utf8');
 const rollback=readFileSync(new URL('../sql/alpha45_STAGING_ONLY_ROLLBACK.sql',import.meta.url),'utf8');
 assert.match(sql,/create unique index if not exists v7_pending_student_day_unique/);
 assert.match(sql,/where status='待审核'/);
 assert.match(pre,/duplicate_pending_groups/);
 assert.match(pre,/pending_unique_index_installed/);
 assert.match(rollback,/drop index if exists public.v7_pending_student_day_unique/);
});

test('Alpha46 hung write response is ambiguous, not rejected as a rolled-back transaction',async()=>{
 let callCount=0;
 await assert.rejects(()=>withUncertainWriteDeadline(()=>{callCount++;return new Promise(()=>{})},60),error=>{
  assert.equal(error.code,'V7_OUTCOME_UNKNOWN');
  assert.equal(uncertainWriteOutcome(error),true);
  return true;
 });
 assert.equal(callCount,1);
});
test('Alpha46 successful write response remains successful and known validation failure stays definite',async()=>{
 assert.equal(await withUncertainWriteDeadline(async()=>({id:'confirmed'}),100).then(x=>x.id),'confirmed');
 await assert.rejects(()=>withUncertainWriteDeadline(async()=>{throw Object.assign(Error('wrong student'),{code:'23514'})},100),err=>{
  assert.equal(uncertainWriteOutcome(err),false);return true;
 });
});

test('Alpha46 teacher review readback checks exact row and remains read-only',async()=>{
 const calls=[];
 const client={
  auth:{getUser:async()=>({data:{user:{id:uid}},error:null})},
  rpc:async()=>({data:{},error:null}),
  from(table){
   const filters=[];
   const q={
    select(cols){filters.push(['select',cols]);return q},
    eq(k,v){filters.push(['eq',k,v]);return q},
    async maybeSingle(){calls.push({table,filters});return {data:{id:sid,class_id:cid,status:'已通过',reviewed_at:'2026-11-28T00:00:00Z'},error:null}}
   };
   return q;
  }
 };
 const result=await createSafeWorkflow(client).verifyReview({classId:cid,submissionId:sid});
 assert.equal(result.status,'已通过');
 assert.equal(calls.length,1);assert.equal(calls[0].table,'cadre_submissions');
 assert.ok(calls[0].filters.some(([op,k,v])=>op==='eq'&&k==='class_id'&&v===cid));
 assert.ok(calls[0].filters.some(([op,k,v])=>op==='eq'&&k==='id'&&v===sid));
});
test('Alpha46 teacher review prevents repeated approval after ambiguous network result',()=>{
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../src/components/ReviewPanel.tsx',import.meta.url),'utf8');
 assert.match(app,/async function reconcileUncertainReview\(/);
 assert.match(app,/setUncertainReview\(\{accountId:account,classId:submittedClass,id\}\)/);
 assert.match(app,/await withUncertainWriteDeadline\(\(\)=>bridges.writer.review/);
 assert.match(app,/record.status==='已通过'\|\|record.status==='已驳回'/);
 assert.match(ui,/uncertainReviewId===i.id/);
 assert.match(ui,/核对审核结果/);
});
