import test from 'node:test';
import assert from 'node:assert/strict';
import {createEventCaseApi} from '../src/lib/event-case-api.mjs';
const classId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherClass='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const owner='11111111-1111-4111-8111-111111111111';
const cadre='33333333-3333-4333-8333-333333333333';
const student='aaaaaaaa-0000-4000-8000-000000000001';
const uuid=(n)=>`aaaaaaaa-0000-4000-8000-${String(n).padStart(12,'0')}`;
const rows=[
 {id:uuid(1),class_id:classId,student_id:student,kind:'违纪',title:'待指派',status:'待分派',assigned_to:null,created_by:cadre,updated_at:'2026-11-26T08:00:00Z'},
 {id:uuid(2),class_id:classId,student_id:student,kind:'值日',title:'待复核',status:'待复核',assigned_to:cadre,created_by:owner,updated_at:'2026-11-27T08:00:00Z'},
 {id:uuid(3),class_id:classId,student_id:student,kind:'考勤',title:'我的处理中',status:'处理中',assigned_to:owner,created_by:owner,updated_at:'2026-11-28T08:00:00Z'},
 {id:uuid(4),class_id:classId,student_id:student,kind:'请假',title:'分给干部',status:'处理中',assigned_to:cadre,created_by:owner,updated_at:'2026-11-28T09:00:00Z'},
 {id:uuid(5),class_id:otherClass,student_id:student,kind:'积分',title:'其他班',status:'待分派',assigned_to:null,created_by:cadre,updated_at:'2026-11-28T10:00:00Z'}
];
function fake(role='owner',blocked=false){
 const account=role==='owner'?owner:cadre,queries=[];
 const client={
  auth:{getUser:async()=>({data:{user:{id:account}},error:null})},
  rpc:async()=>({data:null,error:null}),
  from(table){
   const q={table,conditions:[],limit:null};queries.push(q);
   const result=()=>rows.filter(r=>r.class_id===classId&&q.conditions.every(([k,v])=>r[k]===v));
   const chain={
    select(_f,opt){q.exact=opt?.count==='exact';return chain},
    eq(k,v){q.conditions.push([k,v]);return chain},
    order(){return chain},
    limit(n){q.limit=n;const data=result();return Promise.resolve({data:data.slice(0,n),count:data.length,error:null})},
    range(a,b){const data=result();return Promise.resolve({data:data.slice(a,b+1),count:data.length,error:null})},
    maybeSingle(){
     if(table==='classes')return Promise.resolve({data:role==='owner'?{id:classId}:null,error:null});
     if(table==='class_delegates')return Promise.resolve({data:blocked?null:{id:uuid(33)},error:null});
     return Promise.resolve({data:null,error:null});
    }
   };return chain;
  }
 };
 return {api:createEventCaseApi(client),queries};
}
test('owner inbox includes unassigned, to review, and only owner-assigned processing',async()=>{
 const {api,queries}=fake('owner');
 const summary=await api.taskInbox(classId);
 assert.equal(summary.owned,true);
 assert.equal(summary.total,3);
 assert.deepEqual(summary.groups.map(g=>g.count),[1,1,1]);
 const scoped=queries.filter(q=>q.table==='v7_event_cases');
 assert.equal(scoped.length,3);
 assert.ok(scoped.every(q=>q.conditions.some(([k,v])=>k==='class_id'&&v===classId)));
 assert.ok(scoped.some(q=>q.conditions.some(([k,v])=>k==='assigned_to'&&v===owner)));
 assert.equal(summary.groups[2].items[0].title,'我的处理中');
});
test('cadre inbox shows only own work and own unassigned requests',async()=>{
 const {api,queries}=fake('cadre');
 const result=await api.taskInbox(classId);
 assert.equal(result.owned,false);
 assert.equal(result.total,2);
 assert.deepEqual(result.groups.map(g=>g.count),[1,1]);
 assert.equal(result.groups[0].items[0].title,'分给干部');
 assert.equal(result.groups[1].items[0].title,'待指派');
 assert.ok(queries.some(q=>q.table==='class_delegates'));
});
test('disabled cadre cannot receive a misleading all-clear',async()=>{
 await assert.rejects(()=>fake('cadre',true).api.taskInbox(classId),/已无班级待办访问权限/);
});
test('case list supports exact inbox id and student dossier filter in server query',async()=>{
 const {api,queries}=fake('owner');
 const result=await api.list(classId,{page:1,pageSize:10,caseId:uuid(4),studentId:student,status:'全部'});
 assert.equal(result.items.length,1);
 assert.equal(result.items[0].id,uuid(4));
 const q=queries.find(v=>v.table==='v7_event_cases');
 assert.ok(q.conditions.some(([k,v])=>k==='id'&&v===uuid(4)));
 assert.ok(q.conditions.some(([k,v])=>k==='student_id'&&v===student));
 await assert.rejects(()=>api.list(classId,{page:1,pageSize:10,caseId:'NOT_UUID'}));
});
