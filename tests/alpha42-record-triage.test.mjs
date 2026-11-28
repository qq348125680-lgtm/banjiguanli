import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pendingRecordChecks} from '../src/lib/record-checks.mjs';
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
