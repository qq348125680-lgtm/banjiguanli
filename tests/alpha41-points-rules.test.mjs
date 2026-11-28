import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {previewPointRule} from '../src/lib/point-rule-preview.mjs';
import {createReadOnlyBridge} from '../src/lib/supabase-readonly-adapter.mjs';
const owner='11111111-1111-4111-8111-111111111111',classId='22222222-2222-4222-8222-222222222222';
function fakeClient(isOwner){
 const calls=[];
 const data={
  classes:isOwner?[{id:classId,name:'测试班',owner_id:owner}]:[],
  point_rules:[{id:'r1',class_id:classId,code:'R01',label:'纪律',dimension:'行为规范',unit_points:-2,threshold:2,converted_points:-5,enabled:true,source_note:'原系统已有规则'}]
 };
 function from(table){
  const filters=[];
  const q={
   select(fields){filters.push(['select',fields]);return q},
   eq(k,v){filters.push(['eq',k,v]);return q},
   order(k){filters.push(['order',k]);return q},
   limit(n){filters.push(['limit',n]);return q},
   then(ok,fail){calls.push({table,filters});let rows=data[table]??[];for(const [op,k,v] of filters){if(op==='eq')rows=rows.filter(x=>x[k]===v)}return Promise.resolve({data:rows,error:null}).then(ok,fail)}
  };
  return q;
 }
 return {client:{auth:{getUser:async()=>({data:{user:{id:owner}},error:null})},from},calls};
}
test('Alpha41 owner reads only existing class point rules and bounded columns',async()=>{
 const {client,calls}=fakeClient(true);
 const data=await createReadOnlyBridge(client).pointRulesForOwner(classId);
 assert.equal(data.length,1);assert.equal(data[0].unit_points,-2);
 assert.ok(calls.find(x=>x.table==='point_rules').filters.some(([op,k,v])=>op==='eq'&&k==='class_id'&&v===classId));
 assert.ok(calls.find(x=>x.table==='point_rules').filters.some(([op,n])=>op==='limit'&&n===300));
});
test('Alpha41 unauthorized class cannot fetch point rules',async()=>{
 const {client,calls}=fakeClient(false);
 await assert.rejects(()=>createReadOnlyBridge(client).pointRulesForOwner(classId));
 assert.equal(calls.some(x=>x.table==='point_rules'),false);
});
test('Alpha41 point rules preview is local, bounded and does not silently apply threshold',()=>{
 const rule={unit_points:-2,threshold:2,converted_points:-5};
 assert.deepEqual(previewPointRule(rule,2),{unit:-2,times:2,total:-4,requiresThresholdReview:true});
 assert.equal(previewPointRule(rule,3,-1).total,-3);
 assert.throws(()=>previewPointRule(rule,0));
 assert.throws(()=>previewPointRule(rule,100));
 assert.throws(()=>previewPointRule({unit_points:'unknown'},1));
});
test('Alpha41 points rule UI is owner-only and never writes to production',()=>{
 const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
 const app=read('../src/App.tsx');
 const panel=read('../src/components/PointRulesPanel.tsx');
 assert.match(app,/view==='records'&&\(!owned\?<><div className="student-center-tabs"/);
 assert.match(app,/recordTab!=='cases'&&<EventCenterPanel/);
 assert.match(app,/recordTab==='cases'&&<EventCaseBoard/);
 assert.match(app,/:<><div className="student-center-tabs"/);
 assert.match(app,/recordTab==='rules'&&<PointRulesPanel/);
 assert.match(app,/PointRulesPanel key=/);
 assert.match(panel,/仅用于试算|输入仅用于试算/);
 assert.match(panel,/不包含正式阈值折算/);
 assert.match(panel,/不会保存到数据库/);
 assert.doesNotMatch(panel,/\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
});
