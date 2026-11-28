import test from 'node:test';
import assert from 'node:assert/strict';
import {assertRestrictedRead,assertOwnedSubmissionRows,requireForeignSyntheticFixture,assertNoForeignRows,assertOwnerActiveStudents} from '../src/lib/staging-access-assertions.mjs';
const classA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const cadre='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const foreign='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
test('RLS direct access allows empty rows and genuine 42501, never leaked rows',()=>{
 assert.equal(assertRestrictedRead({data:[],error:null},'student table'),'empty');
 assert.equal(assertRestrictedRead({data:null,error:{code:'42501'}},'students'),'denied');
 assert.throws(()=>assertRestrictedRead({data:[{id:'foreign'}],error:null},'students'),/权限验收失败/);
});
test('RLS check does not accept arbitrary 5xx, stale auth or broken API as denial',()=>{
 for(const response of [{data:null,error:{code:'PGRST301'}},{data:null,error:{code:'503'}},{data:null,error:null},{data:{id:'x'},error:null}])
  assert.throws(()=>assertRestrictedRead(response,'students'));
});
test('cadre direct query must not reveal any different submitter or class',()=>{
 const valid=[{id:'id1',submitted_by:cadre,class_id:classA}];
 assert.equal(assertOwnedSubmissionRows({data:valid,error:null},cadre,classA),1);
 assert.throws(()=>assertOwnedSubmissionRows({data:[{...valid[0],submitted_by:foreign}],error:null},cadre,classA),/非本人/);
 assert.throws(()=>assertOwnedSubmissionRows({data:[{...valid[0],class_id:foreign}],error:null},cadre,classA),/非本人/);
 assert.throws(()=>assertOwnedSubmissionRows({data:[],error:{code:'42501'}},cadre,classA));
});
test('must seed an actual other-cadre submission to prove privacy',()=>{
 const ownerRows=[{id:'foreignrow',class_id:classA,submitted_by:foreign},{id:'mine',class_id:classA,submitted_by:cadre}];
 const foreignIds=requireForeignSyntheticFixture(ownerRows,cadre,classA);
 assert.equal(foreignIds.has('foreignrow'),true);
 assert.equal(assertNoForeignRows([{id:'mine'}],foreignIds),true);
 assert.throws(()=>assertNoForeignRows([{id:'foreignrow'}],foreignIds),/跨干部/);
 assert.throws(()=>requireForeignSyntheticFixture([{id:'mine',class_id:classA,submitted_by:cadre}],cadre,classA),/造样本/);
});

test('positive owner student RLS proof rejects empty, archived and cross-class rows',()=>{
 const active=[
  {id:'s1',class_id:classA,archived_at:null},
  {id:'s2',class_id:classA,archived_at:null}
 ];
 assert.equal(assertOwnerActiveStudents({data:active,error:null},classA),2);
 assert.throws(()=>assertOwnerActiveStudents({data:[],error:null},classA),/至少有两名/);
 assert.throws(()=>assertOwnerActiveStudents({data:[active[0]],error:null},classA),/至少有两名/);
 assert.throws(()=>assertOwnerActiveStudents({data:[active[0],{...active[1],class_id:foreign}],error:null},classA),/超出预期/);
 assert.throws(()=>assertOwnerActiveStudents({data:[active[0],{...active[1],archived_at:'2026-11-28'}],error:null},classA),/归档/);
 assert.throws(()=>assertOwnerActiveStudents({data:active,error:{code:'42501'}},classA),/无法直接读取/);
});
