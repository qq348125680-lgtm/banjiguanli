import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(name)=>readFileSync(new URL(name,import.meta.url),'utf8');
const app=read('../src/App.tsx');
const entry=read('../src/components/AttendanceEntryPanel.tsx');
const review=read('../src/components/ReviewPanel.tsx');
const progress=read('../src/components/EntryProgress.tsx');
test('business panels are extracted and integrated, with no duplicate inline panels',()=>{
 assert.match(app,/import \{AttendanceEntryPanel\}/);
 assert.match(app,/import \{ReviewPanel\}/);
 assert.match(app,/view==='entry'&&<AttendanceEntryPanel/);
 assert.match(app,/view==='review'&&<ReviewPanel/);
 assert.doesNotMatch(app,/<h2>班干部快捷考勤<\/h2>/);
 assert.doesNotMatch(app,/<h2>\{owned\?'班主任审核中心'/);
});
test('filtering unfinished students does not alter underlying roster',async()=>{
 const {progressStudents}=await import('../src/lib/list-view.mjs');
 const roster=[{id:'1',name:'学生一',student_no:'001'},{id:'2',name:'学生二',student_no:'002'}];
 const result=progressStudents(roster,['1','1'],'',true);
 assert.equal(result.done,1);
 assert.deepEqual(result.visible.map(s=>s.id),['2']);
 assert.deepEqual(roster.map(s=>s.id),['1','2']);
 assert.match(progress,/checked=\{onlyOutstanding\}/);
 assert.match(progress,/progressStudents\(roster,completed,search,onlyOutstanding\)/);
 assert.doesNotMatch(progress,/(insert\(|upsert\(|\.rpc\()/);
});
test('entry inputs are held during mutation and persist only on successful submission',()=>{
 assert.match(entry,/disabled=\{p\.busy\|\|p\.loading\}/);
 assert.match(entry,/!p\.completed\.includes\(p\.selected\)/);
 assert.match(app,/await bridges\.writer\.submit/);
 assert.match(app,/if\(scopeRef\.current===operationScope\)\{setNote\(''\)/);
});
test('review is restricted to actionable records and requires a note for rejection',()=>{
 assert.match(review,/i\.status==='待审核'/);
 assert.match(review,/canReviewSubmission/);
 assert.match(review,/p\.notes\[i\.id\]/);
 assert.match(review,/p\.canWrite/);
});
test('stale completion messages are fenced by current user, class and date',()=>{
 assert.match(app,/scopeRef\.current=`\$\{user\?\.id/);
 assert.ok((app.match(/scopeRef\.current===operationScope/g)||[]).length>=4);
});
