import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const app=fs.readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
test('permission revalidation masks the entire class workspace',()=>{
  const guard=app.indexOf('if(user && classId && authorizationChecking)return');
  const shell=app.indexOf('return <div className="shell">');
  assert.ok(guard>=0 && guard<shell,'mask must render before the workspace');
  assert.match(app.slice(guard,shell),/验证期间已临时隐藏学生名单、审核记录和操作日志/);
});
test('mask is not used when no user or class is selected',()=>{
  assert.match(app,/if\(user && classId && authorizationChecking\)return/);
});
test('authorization failure invalidates the current snapshot',()=>{
  assert.match(app,/setAuthorizationBlocked\(true\);[\s\S]*?loadedScopeRef\.current='';/);
  assert.match(app,/setStudents\(\[\]\);setRoster\(\[\]\);setRosterLoaded\(false\)/);
});
test('mask does not remove the prior success snapshot strategy',()=>{
  assert.match(app,/decideSnapshot\(loadedScopeRef\.current,user\.id,classId\)/);
});
