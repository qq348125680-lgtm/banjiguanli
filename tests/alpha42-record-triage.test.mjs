import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pendingRecordChecks,exportRecordChecksCsv} from '../src/lib/record-checks.mjs';
test('Alpha42 unnoted absence is suggested for manual verification without changes',()=>{
 const row={id:'att1',student_id:'stu1',status:'缺勤',note:''};
 const result=pendingRecordChecks('考勤',[row]);
 assert.equal(result.length,1);
 assert.match(result[0].reason[0],/缺少说明/);
 assert.deepEqual(row,{id:'att1',student_id:'stu1',status:'缺勤',note:''});
});
test('Alpha42 pending leave, date inversion, unassigned duties and category gaps are flagged',()=>{
 assert.equal(pendingRecordChecks('请假',[{id:'leave1',status:'待审核',start_on:'2026-11-29',end_on:'2026-11-28'}])[0].reason.length,2);
 assert.match(pendingRecordChecks('值日',[{id:'d1',area:''}])[0].reason[0],/未填写负责区域/);
 assert.match(pendingRecordChecks('违纪',[{id:'i1',category:''}])[0].reason[0],/类别/);
});
test('Alpha42 completed or ordinary records are not falsely called pending',()=>{
 assert.deepEqual(pendingRecordChecks('考勤',[{id:'a',status:'出勤'}]),[]);
 assert.deepEqual(pendingRecordChecks('请假',[{id:'l',status:'已批准',start_on:'2026-11-28',end_on:'2026-11-29'}]),[]);
 assert.deepEqual(pendingRecordChecks('不支持的类型',[{id:'u'}]),[]);
});
test('Alpha42 session acknowledgment cannot imply official closure or commit writes',()=>{
 const src=readFileSync(new URL('../src/components/RecordChecksPanel.tsx',import.meta.url),'utf8');
 const parent=readFileSync(new URL('../src/components/ClassRecordsPanel.tsx',import.meta.url),'utf8');
 assert.match(src,/本页已查看/);
 assert.match(src,/不写入数据库、不作为正式结案/);
 assert.match(parent,/key=\{\`\$\{queryKey\}:checks\`\}/);
 assert.doesNotMatch(src,/\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
});

test('Alpha44 printable follow-up CSV exports just current-page safe checklist fields',()=>{
 const flags=pendingRecordChecks('考勤',[{id:'a',student_id:'s1',on_date:'2026-11-28',status:'旷课',note:''}]);
 const csv=exportRecordChecksCsv('考勤',flags,[{id:'s1',name:'王同学'}]);
 assert.equal(csv.charCodeAt(0),0xfeff);
 assert.match(csv,/王同学/);assert.match(csv,/2026-11-28/);
 assert.match(csv,/待人工核实/);
 assert.doesNotMatch(csv,/家长电话|身份证/);
 const ui=readFileSync(new URL('../src/components/RecordChecksPanel.tsx',import.meta.url),'utf8');
 assert.match(ui,/导出当前页待核对清单 CSV/);
 assert.match(ui,/exportRecordChecksCsv\(kind,checks,students\)/);
});
test('Alpha44 private communications and oversized follow-up exports are refused',()=>{
 assert.throws(()=>exportRecordChecksCsv('家校沟通',[],[]));
 assert.throws(()=>exportRecordChecksCsv('考勤',Array.from({length:21},(_,i)=>({id:String(i),student_id:'s1',reason:['foo']})),[]));
 const danger=exportRecordChecksCsv('违纪',[{id:'x',student_id:'s1',date:'2026-11-28',reason:['=FORMULA()']}],[{id:'s1',name:'=CMD()'}]);
 assert.ok(danger.includes("'=CMD()"));
 assert.ok(danger.includes('待人工核实'));
});
