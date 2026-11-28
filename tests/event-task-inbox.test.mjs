import test from 'node:test';
import assert from 'node:assert/strict';
import {inboxDefinitions,assertInboxQueryResult,buildInboxSummary} from '../src/lib/event-task-inbox.mjs';
const classId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const owner='11111111-1111-4111-8111-111111111111';
const cadre='33333333-3333-4333-8333-333333333333';
const item={id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',class_id:classId,student_id:'aaaaaaaa-0000-4000-8000-000000000001',title:'虚构待复核事项',kind:'值日',status:'待复核',assigned_to:cadre,created_by:owner,updated_at:'2026-11-28T10:00:00Z'};
test('teacher and cadre inbox definitions are distinct and account-scoped',()=>{
 const own=inboxDefinitions(true,owner),cad=inboxDefinitions(false,cadre);
 assert.deepEqual(own.map(x=>x.id),['owner_unassigned','owner_review','owner_self']);
 assert.deepEqual(cad.map(x=>x.id),['cadre_assigned','cadre_created']);
 assert.equal(own[2].filter.id,owner);
 assert.equal(cad[0].filter.column,'assigned_to');
 assert.equal(cad[1].filter.column,'created_by');
 assert.throws(()=>inboxDefinitions(false,''),/登录/);
});
test('exact positive counts and minimal previews are kept separate',()=>{
 const group=inboxDefinitions(true,owner)[1];
 const output=assertInboxQueryResult({data:[item],count:12,error:null},group,classId);
 assert.equal(output.count,12);
 assert.equal(output.items.length,1);
 assert.equal(output.items[0].title,'虚构待复核事项');
 assert.equal('description' in output.items[0],false);
 const summary=buildInboxSummary([output,{...output,id:'a',count:0,items:[]}]);
 assert.equal(summary.total,12);
 assert.match(summary.message,/不是已读回执/);
});
test('unavailable counts and unverified or cross-class rows must not become 0',()=>{
 const group=inboxDefinitions(true,owner)[1];
 for(const response of [{data:[],count:null,error:null},{data:[],count:0,error:{code:'42501'}},{data:null,count:0,error:null},{data:[item],count:0,error:null}]){
  assert.throws(()=>assertInboxQueryResult(response,group,classId));
 }
 for(const bad of [{...item,class_id:'other'},{...item,status:'已结案'}]){
  assert.throws(()=>assertInboxQueryResult({data:[bad],count:1,error:null},group,classId));
 }
});
test('my task rows cannot include another user even if RLS query accidentally changes',()=>{
 const group=inboxDefinitions(false,cadre)[0];
 assert.doesNotThrow(()=>assertInboxQueryResult({data:[{...item,status:'处理中'}],count:1,error:null},group,classId));
 assert.throws(()=>assertInboxQueryResult({data:[{...item,status:'处理中',assigned_to:owner}],count:1,error:null},group,classId),/责任范围/);
});
