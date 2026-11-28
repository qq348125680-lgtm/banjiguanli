import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {canReviewSubmission} from '../src/lib/domain.mjs';
const make=(type,status='待审核')=>[{id:'1',entry_type:type,status}];
for (const action of ['approve','reject']) {
  test(`${action} only permits pending attendance`,()=>{
    assert.equal(canReviewSubmission(make('考勤'),'1',action),true);
    for (const type of ['请假','违纪','成长积分']) assert.equal(canReviewSubmission(make(type),'1',action),false);
    assert.equal(canReviewSubmission(make('考勤','已通过'),'1',action),false);
    assert.equal(canReviewSubmission(make('考勤','已驳回'),'1',action),false);
  });
}
test('review page never renders approval actions for unmigrated categories',()=>{
 const src=fs.readFileSync(new URL('../src/components/ReviewPanel.tsx',import.meta.url),'utf8');
 assert.match(src,/i\.entry_type==='考勤'&&<div className="review-actions">/);
 assert.match(src,/i\.entry_type!=='考勤'&&<p className="muted">/);
});
