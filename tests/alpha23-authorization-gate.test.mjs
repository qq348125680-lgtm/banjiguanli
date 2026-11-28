import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canReadAuthorizedScope} from '../src/lib/snapshot-policy.mjs';

const base={hasBridge:true,hasUser:true,classId:'class-a',authorizedClassIds:['class-a'],authorizationBlocked:false};
test('a verified scope may start read operations',()=>assert.equal(canReadAuthorizedScope(base),true));
test('failed authorization blocks sensitive queries',()=>assert.equal(canReadAuthorizedScope({...base,authorizationBlocked:true}),false));
test('a missing user blocks reads even with override',()=>assert.equal(canReadAuthorizedScope({...base,hasUser:false,verifiedOverride:true}),false));
test('a missing selected class blocks reads even with override',()=>assert.equal(canReadAuthorizedScope({...base,classId:'',verifiedOverride:true}),false));
test('unconfigured bridge blocks queries',()=>assert.equal(canReadAuthorizedScope({...base,hasBridge:false}),false));
test('only an awaited successful authorization refresh may override the old blocked state',()=>assert.equal(canReadAuthorizedScope({...base,authorizationBlocked:true,verifiedOverride:true}),true));
test('App data load checks authorization before invoking scoped queries',()=>{
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 const guard=app.indexOf('if(!canReadAuthorizedScope(');
 const request=app.indexOf('await loadScopedPanels(');
 assert.ok(guard>=0 && request>guard);
 assert.match(app,/await loadData\(\[\.\.\.data\.owned/);
});
test('automatic authorization failure purges existing state, not just the error banner',()=>{
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 const fail=app.indexOf("setProblem('读取班级授权失败");
 assert.ok(fail>0);
 const earlier=app.slice(Math.max(0,fail-550),fail);
 assert.match(earlier,/setStudents\(\[\]\)/);
 assert.match(earlier,/setClasses\(\[\]\)/);
 assert.match(earlier,/requestSeq\.current\+\+/);
});
