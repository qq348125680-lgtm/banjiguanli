import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReadOnlyBridge} from '../src/lib/supabase-readonly-adapter.mjs';
const owner='11111111-1111-4111-8111-111111111111',cid='22222222-2222-4222-8222-222222222222',uid='33333333-3333-4333-8333-333333333333',sid='44444444-4444-4444-8444-444444444444';
function fakeClient({ownerEnabled=true,studentEnabled=true}={}){
 const calls=[];
 const values={
  classes:ownerEnabled?[{id:cid,owner_id:owner,name:'测试班'}]:[],
  students:studentEnabled?[{id:sid,class_id:cid,student_no:'1',name:'测试学生',archived_at:null}]:[],
  class_delegates:[{user_id:uid,student_id:sid,class_id:cid,duty:'班长',enabled:true},{user_id:owner,student_id:null,class_id:cid,duty:'未关联学生',enabled:false}]
 };
 function from(table){
  const f=[];
  const query={
   select(columns){f.push(['select',columns]);return query},
   eq(k,v){f.push(['eq',k,v]);return query},
   is(k,v){f.push(['is',k,v]);return query},
   order(k){f.push(['order',k]);return query},
   limit(n){f.push(['limit',n]);return query},
   then(ok,bad){
    calls.push({table,f});
    let rows=values[table]??[];
    for(const [type,k,v] of f){
     if(type==='eq')rows=rows.filter(x=>x[k]===v);
     if(type==='is')rows=rows.filter(x=>x[k]===v);
    }
    return Promise.resolve({data:rows,error:null}).then(ok,bad);
   }
  };
  return query;
 }
 return {client:{auth:{getUser:async()=>({data:{user:{id:owner}},error:null})},from},calls};
}
test('Alpha45 only owner resolves linked class delegate UID into active roster name',async()=>{
 const {client,calls}=fakeClient();const r=await createReadOnlyBridge(client).cadreDirectoryForOwner(cid);
 assert.equal(r.length,2);
 assert.deepEqual(r[0],{uid,name:'测试学生',duty:'班长',enabled:true});
 assert.equal(r[1].name,null);
 assert.equal(r[1].enabled,false);
 const studentQuery=calls.find(x=>x.table==='students');
 assert.ok(studentQuery.f.some(([op,key])=>op==='select'&&key==='id,student_no,name,class_id,archived_at'));
});
test('Alpha45 does not infer identity when student archived or inaccessible',async()=>{
 const {client}=fakeClient({studentEnabled:false});
 const r=await createReadOnlyBridge(client).cadreDirectoryForOwner(cid);
 assert.equal(r[0].name,null);
});
test('Alpha45 unauthorized owner gets no delegate info',async()=>{
 const {client,calls}=fakeClient({ownerEnabled:false});
 await assert.rejects(()=>createReadOnlyBridge(client).cadreDirectoryForOwner(cid));
 assert.equal(calls.some(x=>x.table==='class_delegates'),false);
});
test('Alpha45 review owner directory is scoped to class and cleared on change',()=>{
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 const panel=readFileSync(new URL('../src/components/ReviewPanel.tsx',import.meta.url),'utf8');
 assert.match(app,/view!=='review'/);
 assert.match(app,/setCadreDirectory\(\[\]\)/);
 assert.match(app,/cadreDirectoryForOwner\(classId\)/);
 assert.match(panel,/actorNames.get\(s.actorId\)\?\.name/);
 assert.match(panel,/title=\{s.actorId\}/);
});
