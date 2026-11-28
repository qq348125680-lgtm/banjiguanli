import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summarizeVisibleReviews} from '../src/lib/reports-summary.mjs';

test('Alpha39 scoped report counts only supplied authorized page',()=>{
 const v=summarizeVisibleReviews([{status:'待审核'},{status:'已通过'},{status:'已通过'},{status:'已驳回'},{status:'未知'}]);
 assert.equal(v.sampleSize,5);
 assert.deepEqual(v.statuses,{'待审核':1,'已通过':2,'已驳回':1,'其他':1});
});
test('Alpha39 empty page never fabricates a class-level report',()=>{
 const v=summarizeVisibleReviews([]);
 assert.equal(v.sampleSize,0);
 assert.equal(Object.values(v.statuses).reduce((a,b)=>a+b,0),0);
});
test('Alpha39 report UI labels page-only statistics and avoids privileged exports',()=>{
 const panel=readFileSync(new URL('../src/components/ReportsPanel.tsx',import.meta.url),'utf8');
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 assert.match(panel,/仅统计本次已加载的/);
 assert.match(panel,/不代表全班、整月或整学期/);
 assert.match(panel,/不提供敏感记录导出/);
 assert.match(app,/<ReportsPanel/);
 assert.match(app,/view==='archive'&&!owned/);
});
