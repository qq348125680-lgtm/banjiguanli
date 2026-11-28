import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReadOnlyBridge} from '../src/lib/supabase-readonly-adapter.mjs';
const owner='11111111-1111-4111-8111-111111111111';
const classId='22222222-2222-4222-8222-222222222222';
const studentId='33333333-3333-4333-8333-333333333333';
function makeClient({ownerEnabled=true}={}){
 const calls=[];
 const records={
  classes:ownerEnabled?[{id:classId,owner_id:owner,name:'测试班'}]:[],
  students:[{id:studentId,class_id:classId,name:'学生甲',student_no:'001',seat_no:3,group_name:'1组'}],
  dorm_rooms:[{id:'room1',class_id:classId,room_no:'508'}],
  dorm_beds:[{id:'bed1',room_id:'room1',bed_no:1,student_id:studentId}],
  class_delegates:[{class_id:classId,student_id:studentId,duty:'班长',enabled:true,permissions:['attendance']}],
  class_seat_settings:[{class_id:classId,seat_rows:6,seat_cols:8,ordering:'by_student_no'}]
 };
 function from(table){
  const ops=[];
  const q={
   select(fields){ops.push(['select',fields]);return q},
   eq(name,value){ops.push(['eq',name,value]);return q},
   is(name,value){ops.push(['is',name,value]);return q},
   in(name,value){ops.push(['in',name,value]);return q},
   order(name){ops.push(['order',name]);return q},
   maybeSingle(){calls.push({table,ops});let list=filter();return Promise.resolve({data:list[0]??null,error:null})},
   then(ok,fail){calls.push({table,ops});return Promise.resolve({data:filter(),error:null}).then(ok,fail)}
  };
  function filter(){
   let list=records[table]??[];
   for(const [method,name,value] of ops){
    if(method==='eq')list=list.filter(x=>x[name]===value);
    if(method==='in')list=list.filter(x=>value.includes(x[name]));
   }
   return list;
  }
  return q;
 }
 return {client:{auth:{getUser:async()=>({data:{user:{id:owner}},error:null})},from},calls};
}
test('Alpha40 organization reader loads seats dorms cadres without privileged key or writes',async()=>{
 const {client,calls}=makeClient();
 const result=await createReadOnlyBridge(client).classOrganizationForOwner(classId);
 assert.equal(result.students.data[0].seat_no,3);
 assert.equal(result.rooms.data[0].room_no,'508');
 assert.equal(result.beds.data[0].bed_no,1);
 assert.equal(result.delegates.data[0].duty,'班长');
 assert.equal(result.seat.data.seat_rows,6);
 assert.ok(calls.some(c=>c.table==='dorm_beds'&&c.ops.some(([op])=>op==='in')));
 assert.ok(!calls.some(c=>c.table==='students'&&c.ops[0]?.[1].includes('id_card')));
});
test('Alpha40 unrelated owner cannot request dorm or cadre private records',async()=>{
 const {client,calls}=makeClient({ownerEnabled:false});
 await assert.rejects(()=>createReadOnlyBridge(client).classOrganizationForOwner(classId));
 assert.equal(calls.some(c=>['dorm_rooms','dorm_beds','class_delegates'].includes(c.table)),false);
});
test('Alpha40 student submodule is owner-gated, scoped, with no automatic data mutation',()=>{
 const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
 const app=read('../src/App.tsx');
 const panel=read('../src/components/ClassOrganizationPanel.tsx');
 const source=read('../src/lib/supabase-readonly-adapter.mjs');
 assert.match(app,/owned&&studentTab==='organization'/);
 assert.match(app,/key=\{\`\$\{user.id\}:\$\{classId\}\`\}/);
 assert.match(panel,/seat.*dorm.*cadre/);
 assert.match(panel,/seq.current\+\+/);
 assert.doesNotMatch(panel,/\.insert\(|\.update\(|\.delete\(/);
 assert.match(source,/await verifyOwner\(classId\)/);
});
