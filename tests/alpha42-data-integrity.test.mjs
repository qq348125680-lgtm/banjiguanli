import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {previewPointRule} from '../src/lib/point-rule-preview.mjs';
import {dutyWorkload,proposeDutySubstitute} from '../src/lib/duty-planner.mjs';
test('Alpha42 unconfigured points never turn into a legitimate zero-point result',()=>{
 for(const invalid of [null,undefined,'', '   ','not-a-number']){
  assert.throws(()=>previewPointRule({unit_points:invalid},1));
 }
 assert.equal(previewPointRule({unit_points:0},1).total,0);
 assert.equal(previewPointRule({unit_points:-2,threshold:null},1).requiresThresholdReview,false);
 assert.equal(previewPointRule({unit_points:-2,threshold:2},2).requiresThresholdReview,true);
 assert.throws(()=>previewPointRule({unit_points:1},1,''));
});
test('Alpha42 duplicate persisted duty row does not double charge fairness',()=>{
 const people=[{id:'a',name:'甲',student_no:'01'},{id:'b',name:'乙',student_no:'02'}];
 const records=[{id:'row-1',student_id:'a',area:'拖地',duty_date:'2026-11-27'},{id:'row-1',student_id:'a',area:'拖地',duty_date:'2026-11-27'},{id:'row-2',student_id:'a',area:'扫地',duty_date:'2026-11-28'}];
 const a=dutyWorkload(people,records).find(x=>x.id==='a');
 assert.equal(a.count,2);assert.equal(a.weight,5);
 assert.equal(records.length,3);
});
test('Alpha42 invalid calendar day is rejected by substitute recommendation',()=>{
 assert.throws(()=>proposeDutySubstitute({people:[{id:'a'}],records:[],dutyDate:'2026-02-30',absentStudentId:'a'}),/有效值日日期/);
});
test('Alpha42 scoped roster discarded before refresh and private name not reused after error',()=>{
 const ui=readFileSync(new URL('../src/components/ClassRecordsPanel.tsx',import.meta.url),'utf8');
 assert.match(ui,/setSnapshot\(null\);setRoster\(\[\]\)/);
 assert.match(ui,/已选学生（正在复核权限）/);
 const duty=readFileSync(new URL('../src/components/DutyAdvisorPanel.tsx',import.meta.url),'utf8');
 assert.match(duty,/id:String\(r.id\?\?''\)/);
});
