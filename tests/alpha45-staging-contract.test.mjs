import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSafeWorkflow} from '../src/lib/safe-workflow.mjs';
const migration=readFileSync(new URL('../sql/alpha45_STAGING_ONLY_SAFE_MIGRATION.sql',import.meta.url),'utf8');
const cid='123e4567-e89b-42d3-a456-426614174000';
const sid='123e4567-e89b-42d3-a456-426614174001';
const uid='123e4567-e89b-42d3-a456-426614174002';
function harness({roster=[{student_id:sid}],error=null}={}){
 const calls=[];const client={
  auth:{getUser:async()=>({data:{user:{id:uid}},error:null})},
  rpc:async(name,args)=>{calls.push({kind:'rpc',name,args});return name==='v7_cadre_roster'?{data:roster,error}:{data:{posted:true},error:null}},
  from:table=>({insert:payload=>({select:()=>({single:async()=>{calls.push({kind:'insert',table,payload});return {data:{id:'abc'},error:null}}})}),select:()=>{const q={eq:()=>q,order:()=>q,limit:async()=>({data:[],error:null})};return q}})
 };
 return {calls,client,workflow:createSafeWorkflow(client)};
}
const req={classId:cid,studentId:sid,entryType:'考勤',date:'2026-11-28',status:'迟到',note:'测试'};
test('Alpha45 can submit only if fresh authorized roster still includes student',async()=>{
 const o=harness();
 await o.workflow.submit(req);
 assert.equal(o.calls[0].name,'v7_cadre_roster');
 assert.equal(o.calls[1].table,'cadre_submissions');
});
test('Alpha45 cross-class/archived student absent from RPC never reaches INSERT',async()=>{
 const o=harness({roster:[{student_id:uid}]});
 await assert.rejects(()=>o.workflow.submit(req),/已不在授权班级/);
 assert.equal(o.calls.some(x=>x.kind==='insert'),false);
});
test('Alpha45 revoked delegate roster RPC fails closed before INSERT',async()=>{
 const o=harness({error:{code:'42501',message:'permission denied'}});
 await assert.rejects(()=>o.workflow.submit(req));
 assert.equal(o.calls.some(x=>x.kind==='insert'),false);
});
test('Alpha45 malformed roster response cannot bypass membership validation',async()=>{
 const o=harness({roster:{unexpected:true}});
 await assert.rejects(()=>o.workflow.submit(req));
 assert.equal(o.calls.some(x=>x.kind==='insert'),false);
});
test('Alpha45 staging migration leaves existing policies intact and guards same-class students',()=>{
 assert.match(migration,/STAGING ONLY, NOT APPLIED TO THE LIVE/);
 assert.doesNotMatch(migration,/drop\s+policy\b|alter\s+table[^;]*disable\s+row\s+level\s+security/i);
 assert.match(migration,/before insert or update of student_id, class_id/);
 assert.match(migration,/s\.id = new\.student_id and s\.class_id = new\.class_id/);
 assert.match(migration,/s\.archived_at is null/);
 assert.match(migration,/revoke all on schema v7_private from public, anon, authenticated/);
});
test('Alpha45 staging RPC explicitly checks current owners and enabled delegates and hides sensitive fields',()=>{
 assert.match(migration,/auth\.uid\(\)/);
 assert.match(migration,/d\.user_id=v_uid and d\.enabled is true/);
 assert.match(migration,/select s\.id,s\.student_no,s\.name from public\.students/);
 assert.doesNotMatch(migration,/select s\.\*/);
 assert.match(migration,/grant execute on function public\.v7_cadre_roster\(uuid\) to authenticated/);
 assert.match(migration,/revoke all on function public\.v7_cadre_roster\(uuid\) from public, anon, authenticated/);
});
test('Alpha45 review RPC uses row locking, owner verification and atomic insert with no upsert',()=>{
 assert.match(migration,/where id=p_submission_id for update/);
 assert.match(migration,/c\.id=v_row\.class_id and c\.owner_id=v_uid/);
 assert.match(migration,/v_row\.status <> '待审核'/);
 assert.match(migration,/v_row\.entry_type <> '考勤'/);
 assert.match(migration,/insert into public\.attendance\(student_id,on_date,status,note\)/);
 assert.match(migration,/update public\.cadre_submissions set status='已通过'/);
 assert.doesNotMatch(migration,/on conflict[^;]*do update|upsert\(/i);
 assert.match(migration,/grant execute on function public\.v7_review_attendance\(uuid,text,text\) to authenticated/);
});
