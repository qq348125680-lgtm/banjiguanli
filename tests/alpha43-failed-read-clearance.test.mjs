import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decideReadFailure} from '../src/lib/read-failure-policy.mjs';
const ok=v=>({ok:true,value:v}),fail=()=>({ok:false,error:new Error('permission')});
test('Alpha43 roster errors block entire class, not just a table of students',()=>{
 const d=decideReadFailure({roster:fail(),reviews:ok({items:[]}),audit:ok(null),pending:ok(0)},{owned:true,view:'records'});
 assert.equal(d.blockClass,true);assert.equal(d.clearReviews,true);assert.equal(d.clearAudit,true);assert.equal(d.clearPending,true);
 assert.deepEqual(d.failedNames,['学生名单']);
});
test('Alpha43 review and audit failures clear their own snapshots even on same query',()=>{
 const d=decideReadFailure({roster:ok([]),reviews:fail(),audit:fail(),pending:ok(0)},{owned:true,view:'archive'});
 assert.equal(d.blockClass,false);assert.equal(d.clearReviews,true);assert.equal(d.clearAudit,true);
 assert.deepEqual(d.failedNames,['审核记录','操作日志']);
});
test('Alpha43 pending count errors show unknown, never false zero',()=>{
 const d=decideReadFailure({roster:ok([]),reviews:ok({items:[]}),pending:fail(),audit:ok(null)},{owned:true,view:'dashboard'});
 assert.equal(d.blockClass,false);assert.equal(d.clearPending,true);assert.deepEqual(d.failedNames,['待审核数量']);
});
test('Alpha43 healthy empty results do not imply errors',()=>{
 const d=decideReadFailure({roster:ok([]),reviews:ok({items:[],count:0}),pending:ok(0),audit:ok(null)},{owned:true,view:'archive'});
 assert.deepEqual(d,{blockClass:false,clearReviews:false,clearPending:false,clearAudit:false,failedNames:[]});
});
test('Alpha43 App clears all sensitive material on scope failure before displaying private panels',()=>{
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 assert.match(app,/if\(recovery\.blockClass\)\{/);
 assert.match(app,/setAuthorizationBlocked\(true\)/);
 assert.match(app,/setStudents\(\[\]\);setRoster\(\[\]\);setRosterLoaded\(false\);setItems\(\[\]\)/);
 assert.match(app,/if\(recovery\.clearReviews\)\{setItems\(\[\]\);setTotal\(null\)\}/);
 assert.match(app,/if\(recovery\.clearAudit\)\{setAudits\(\[\]\);setAuditTotal\(null\)\}/);
 assert.doesNotMatch(app,/同查询条件刷新时保留上次成功记录/);
});

test('Alpha43 both authorization refresh paths and global data load have bounded deadlines',()=>{
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 assert.equal(app.split('await withReadDeadline(()=>bridges.reader.authorizedClasses())').length-1,2);
 assert.match(app,/await withReadDeadline\(\(\)=>loadScopedPanels\(/);
 assert.match(app,/setAuthorizationBlocked\(true\)/);
});
