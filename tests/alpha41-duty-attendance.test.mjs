import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dutyWeight,dutyWorkload,proposeDutySubstitute} from '../src/lib/duty-planner.mjs';
import {weekStartMonday,attendanceDigest} from '../src/lib/attendance-digest.mjs';
const people=Array.from({length:10},(_,i)=>({id:'s'+(i+1),student_no:String(i+1).padStart(2,'0'),name:'学生'+(i+1)}));
const duty=[
 {student_id:'s1',duty_date:'2026-11-27',area:'拖地'},
 {student_id:'s2',duty_date:'2026-11-27',area:'扫地'},
 {student_id:'s3',duty_date:'2026-11-27',area:'擦黑板及倒垃圾'},
 {student_id:'s4',duty_date:'2026-11-27',area:'排桌子'},
 {student_id:'s5',duty_date:'2026-11-27',area:'扫地'},
 {student_id:'s6',duty_date:'2026-11-27',area:'拖地'},
 {student_id:'s7',duty_date:'2026-11-27',area:'扫地'},
 {student_id:'s8',duty_date:'2026-11-27',area:'扫地'}
];
test('Alpha41 heavier sweeping/mopping duties receive fair reference weights',()=>{
 assert.equal(dutyWeight('拖地'),3);assert.equal(dutyWeight('扫地'),2);
 assert.equal(dutyWeight('擦黑板+讲台+门窗+倒垃圾'),1);
 assert.equal(dutyWeight('排桌子'),1);
});
test('Alpha41 substitutions exclude scheduled, absent and manually excluded students',()=>{
 const result=proposeDutySubstitute({people,records:duty,dutyDate:'2026-11-27',absentStudentId:'s1',excludedIds:['s9']});
 assert.equal(result.original.area,'拖地');
 assert.equal(result.candidate.id,'s10');
 assert.equal(result.candidate.weight,0);
 assert.deepEqual(duty.map(r=>r.student_id),['s1','s2','s3','s4','s5','s6','s7','s8']);
});
test('Alpha41 no substitute returns explicit unavailable result, never a fabricated assignment',()=>{
 const result=proposeDutySubstitute({people:people.slice(0,8),records:duty,dutyDate:'2026-11-27',absentStudentId:'s1'});
 assert.equal(result.candidate,null);
 assert.match(result.reason,/旧版/);
});
test('Alpha41 rejects a duty request that is not part of the loaded page',()=>{
 assert.throws(()=>proposeDutySubstitute({people,records:duty,dutyDate:'2026-11-26',absentStudentId:'s1'}));
 assert.throws(()=>proposeDutySubstitute({people,records:duty,dutyDate:'2026-11-27',absentStudentId:''}));
});
test('Alpha41 weekly aggregation uses Monday and rounds lateness pairs down',()=>{
 assert.equal(weekStartMonday('2026-11-28'),'2026-11-23');
 const roster=people.slice(0,2);
 const records=[
  {student_id:'s1',on_date:'2026-11-23',status:'迟到'},
  {student_id:'s1',on_date:'2026-11-24',status:'迟到'},
  {student_id:'s1',on_date:'2026-11-25',status:'迟到'},
  {student_id:'s2',on_date:'2026-11-26',status:'病假'},
  {student_id:'s1',on_date:'2026-11-30',status:'缺勤'}
 ];
 const summary=attendanceDigest(records,roster,'2026-11-23');
 assert.equal(summary.totalLate,3);assert.equal(summary.lateEquivalent,1);
 assert.equal(summary.totalAbsent,0);assert.equal(summary.visibleRows,4);
 assert.equal(summary.students[0].lateEquivalent,1);
 assert.deepEqual(records.map(x=>x.status),['迟到','迟到','迟到','病假','缺勤']);
 assert.throws(()=>attendanceDigest(records,roster,'2026-11-24'));
});
test('Alpha41 UI uses read-only source fields and clearly warns about partial pages',()=>{
 const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
 const dutyUi=read('../src/components/DutyAdvisorPanel.tsx');
 const digestUi=read('../src/components/AttendanceDigestPanel.tsx');
 const recordsUi=read('../src/components/ClassRecordsPanel.tsx');
 assert.match(dutyUi,/仅依据当前已加载页|当前页可能并非全部排班/);
 assert.match(dutyUi,/不会修改任何值日安排/);
 assert.match(digestUi,/不代表全周完整数据/);
 assert.match(digestUi,/不自动改写任何正式状态/);
 assert.match(recordsUi,/kind==='值日'&&result&&<DutyAdvisorPanel/);
 assert.match(recordsUi,/kind==='考勤'&&result&&<AttendanceDigestPanel/);
 assert.doesNotMatch(dutyUi+digestUi,/\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
});
