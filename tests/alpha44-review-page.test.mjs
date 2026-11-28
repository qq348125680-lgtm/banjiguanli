import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewPageDigest} from '../src/lib/review-page-digest.mjs';
const t='2026-11-28T00:00:00Z';
test('Alpha44 paged pending review counts never pretend to be global totals',()=>{
 const page=[
 {id:'a',student_id:'1',entry_type:'考勤',occurred_on:'2026-11-24',status:'待审核',created_at:'2026-11-24T00:00:00Z',details:{status:'迟到'}},
 {id:'b',student_id:'1',entry_type:'考勤',occurred_on:'2026-11-24',status:'待审核',created_at:'2026-11-25T00:00:00Z',details:{status:'迟到'}},
 {id:'c',student_id:'2',entry_type:'考勤',occurred_on:'2026-11-26',status:'待审核',created_at:'2026-11-26T00:00:00Z',details:{}},
 {id:'d',status:'已通过'},
 {id:'e',status:'已驳回'}
 ];
 const result=reviewPageDigest(page,new Date(t));
 assert.deepEqual(result.counts,{pending:3,approved:1,rejected:1,unknown:0,total:5});
 assert.equal(result.oldestDays,4);
 assert.equal(result.pending[0].duplicateOnPage,true);
 assert.equal(result.pending[1].duplicateOnPage,true);
 assert.equal(result.pending[2].missingStatus,true);
 assert.equal(result.pending[2].ageDays,2);
});
test('Alpha44 pending review handles empty/invalid timestamp without fake age',()=>{
 assert.deepEqual(reviewPageDigest([],new Date(t)).pending,[]);
 const result=reviewPageDigest([{id:'x',status:'待审核',created_at:'unknown',entry_type:'请假'}],new Date(t));
 assert.equal(result.pending[0].ageDays,null);
 assert.equal(result.oldestDays,0);
 assert.throws(()=>reviewPageDigest([],new Date('garbage')),/日期不合法/);
});
test('Alpha44 reminder UI cannot approve missing attendance statuses or introduce network writes',()=>{
 const source=readFileSync(new URL('../src/components/ReviewPanel.tsx',import.meta.url),'utf8');
 assert.match(source,/reviewPageDigest\(p.items\)/);
 assert.match(source,/Boolean\(hints.get\(i.id\)\?\.missingStatus\)/);
 assert.match(source,/仅统计本次加载的/);
 assert.match(source,/本页有同一学生、日期、类别/);
 assert.doesNotMatch(source,/\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
});

test('Alpha44 actual submitter UIDs are grouped only within supplied page',()=>{
 const d=reviewPageDigest([
  {id:'a',submitted_by:'uid-1',status:'待审核',entry_type:'考勤',created_at:'2026-11-27T00:00:00Z'},
  {id:'b',submitted_by:'uid-1',status:'已通过',entry_type:'考勤'},
  {id:'c',submitted_by:'uid-2',status:'待审核',entry_type:'考勤',created_at:'2026-11-27T00:00:00Z'},
  {id:'d',status:'已驳回'}
 ],new Date(t));
 assert.deepEqual(d.submitters.map(x=>({actor:x.actorId,visible:x.visible,pending:x.pending})),[
  {actor:'uid-1',visible:2,pending:1},
  {actor:'uid-2',visible:1,pending:1},
  {actor:'操作人未知',visible:1,pending:0}
 ]);
 const ui=readFileSync(new URL('../src/components/ReviewPanel.tsx',import.meta.url),'utf8');
 assert.match(ui,/只按审核记录中的真实提交 UID 分组/);
 assert.match(ui,/reviewSummary.submitters.map/);
});
