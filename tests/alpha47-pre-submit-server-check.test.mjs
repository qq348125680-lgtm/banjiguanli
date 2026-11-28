import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSafeWorkflow} from '../src/lib/safe-workflow.mjs';
import {uncertainWriteOutcome,displayError} from '../src/lib/domain.mjs';
const classId='11111111-1111-4111-8111-111111111111';
const studentId='22222222-2222-4222-8222-222222222222';
const actor='33333333-3333-4333-8333-333333333333';
const date='2026-11-28';
const form={classId,studentId,entryType:'考勤',date,status:'迟到',note:'晚到'};
function harness({existing=[],readError=null,rosterError=null}={}){
 const calls=[];
 const client={
  auth:{getUser:async()=>({data:{user:{id:actor}},error:null})},
  rpc:async(name,args)=>{calls.push(['roster',name]);return {data:[{student_id:studentId}],error:rosterError}},
  from:table=>({
   select(columns){
    const filters=[];const q={
     eq(key,value){filters.push([key,value]);return q},
     order(){return q},
     async limit(n){calls.push(['read',table,filters,n]);return {data:existing,error:readError}}
    };return q;
   },
   insert(payload){
    calls.push(['insert',table,payload]);
    return {select:()=>({single:async()=>({data:{id:'new'},error:null})})};
   }
  })
 };
 return {api:createSafeWorkflow(client),calls};
}
test('Alpha47 existing own attendance request survives UI reload and blocks repeat INSERT',async()=>{
 const o=harness({existing:[{id:'old',student_id:studentId,occurred_on:date,entry_type:'考勤',status:'待审核'}]});
 await assert.rejects(()=>o.api.submit(form),error=>{
  assert.equal(error.code,'V7_ALREADY_SUBMITTED');
  assert.match(displayError(error),/已有/);
  assert.equal(uncertainWriteOutcome(error),false);
  return true;
 });
 assert.deepEqual(o.calls.map(x=>x[0]),['roster','read']);
 const q=o.calls[1][2];
 for(const [k,v] of [['class_id',classId],['student_id',studentId],['submitted_by',actor],['occurred_on',date],['entry_type','考勤']])assert.ok(q.some(pair=>pair[0]===k&&pair[1]===v));
});
test('Alpha47 no existing request allows exactly one real INSERT after roster and history read',async()=>{
 const o=harness();
 const result=await o.api.submit(form);
 assert.equal(result.id,'new');
 assert.deepEqual(o.calls.map(x=>x[0]),['roster','read','insert']);
 assert.equal(o.calls[2][2].status,'待审核');
});
test('Alpha47 clearly rejected attendance may be corrected and resubmitted',async()=>{
 const o=harness({existing:[{id:'old',student_id:studentId,occurred_on:date,entry_type:'考勤',status:'已驳回'}]});
 const reply=await o.api.submit(form);
 assert.equal(reply.id,'new');
 assert.deepEqual(o.calls.map(x=>x[0]),['roster','read','insert']);
});
test('Alpha47 approved attendance cannot be re-submitted even after reload',async()=>{
 const o=harness({existing:[{id:'posted',student_id:studentId,occurred_on:date,entry_type:'考勤',status:'已通过'}]});
 await assert.rejects(()=>o.api.submit(form),error=>error.code==='V7_ALREADY_SUBMITTED');
 assert.equal(o.calls.some(x=>x[0]==='insert'),false);
});
test('Alpha47 history read error stops before write with definitive preflight status',async()=>{
 const o=harness({readError:{code:'PGRST301',message:'read unavailable'}});
 await assert.rejects(()=>o.api.submit(form),error=>{
  assert.equal(error.code,'V7_PREFLIGHT_FAILED');
  assert.equal(uncertainWriteOutcome(error),false);
  return true;
 });
 assert.equal(o.calls.some(x=>x[0]==='insert'),false);
});
test('Alpha47 roster network outage cannot be mistaken for ambiguous completed submission',async()=>{
 const o=harness({rosterError:{code:'503',message:'connection error'}});
 await assert.rejects(()=>o.api.submit(form),error=>{
  assert.equal(error.code,'V7_PREFLIGHT_FAILED');
  assert.equal(uncertainWriteOutcome(error),false);
  return true;
 });
 assert.deepEqual(o.calls.map(x=>x[0]),['roster']);
});
test('Alpha47 pending unique index affects attendance but not multiple legitimate leave cases',()=>{
 const read=p=>readFileSync(new URL('../sql/'+p,import.meta.url),'utf8');
 const sql=read('alpha45_STAGING_ONLY_SAFE_MIGRATION.sql');
 const pre=read('alpha45_PREFLIGHT_READONLY.sql');
 assert.match(sql,/on public\.cadre_submissions\(class_id,student_id,occurred_on\)\s*where status='待审核' and entry_type='考勤'/);
 assert.match(pre,/where status='待审核' and entry_type='考勤'/);
 assert.doesNotMatch(sql,/where status='待审核';/);
});
