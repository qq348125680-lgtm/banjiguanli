import test from 'node:test';
import assert from 'node:assert/strict';
import {canSubmitToRoster,canReviewSubmission} from '../src/lib/domain.mjs';
import {readFileSync} from 'node:fs';
test('stale student cannot be submitted to a different class',()=>{
 const student={id:'id1',class_id:'class-A',name:'测试'};
 assert.equal(canSubmitToRoster({roster:[student],studentId:'id1',classId:'class-B',owned:false}),false);
 assert.equal(canSubmitToRoster({roster:[student],studentId:'id1',classId:'class-A',owned:false}),true);
 assert.equal(canSubmitToRoster({roster:[student],studentId:'id1',classId:'class-A',owned:true}),false);
 assert.equal(canSubmitToRoster({roster:[],studentId:'id1',classId:'class-A',owned:false}),false);
});
test('review only pending attendance for both decisions',()=>{
 const rows=[{id:'1',status:'待审核',entry_type:'考勤'},{id:'2',status:'已通过',entry_type:'考勤'},{id:'3',status:'待审核',entry_type:'请假'}];
 assert.equal(canReviewSubmission(rows,'1','approve'),true);
 assert.equal(canReviewSubmission(rows,'1','reject'),true);
 assert.equal(canReviewSubmission(rows,'2','approve'),false);
 assert.equal(canReviewSubmission(rows,'3','approve'),false);
 assert.equal(canReviewSubmission(rows,'3','reject'),false);
 assert.equal(canReviewSubmission(rows,'1','delete'),false);
});
test('approval migration rejects any preexisting attendance, even matching status',()=>{
 const sql=readFileSync(new URL('../sql/alpha45_STAGING_ONLY_SAFE_MIGRATION.sql',import.meta.url),'utf8');
 assert.match(sql,/insert into public\.attendance\(/i);
 assert.doesNotMatch(sql,/on conflict \(student_id,on_date\) do nothing/i);
 assert.match(sql,/for update/i);
 assert.match(sql,/revoke all on function public\.v7_review_attendance/i);
});
test('navigation does not retain prior class data while reloading',()=>{
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 assert.match(app,/setStudents\(\[\]\);setRoster\(\[\]\);setRosterLoaded\(false\);setItems\(\[\]\);setAudits\(\[\]\)/);
 assert.match(app,/operationLock\.current=true/);
 assert.match(app,/scopeRef\.current===operationScope/);
});
