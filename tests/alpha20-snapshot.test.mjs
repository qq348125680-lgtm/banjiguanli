import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {decideSnapshot,resultPolicy} from '../src/lib/snapshot-policy.mjs';
test('first load clears unknown scope',()=>assert.equal(decideSnapshot('', 'u1','c1').clear,true));
test('same class refresh keeps last successful snapshot',()=>assert.equal(decideSnapshot('u1:c1','u1','c1').clear,false));
test('switch class always clears prior data',()=>assert.equal(decideSnapshot('u1:c1','u1','c2').clear,true));
test('switch account always clears prior data',()=>assert.equal(decideSnapshot('u1:c1','u2','c1').clear,true));
test('logout clears prior data',()=>assert.equal(decideSnapshot('u1:c1','','').clear,true));
test('successful empty fetch is really zero records',()=>assert.deepEqual(resultPolicy({ok:true,value:[]},[{id:1}]),{value:[],stale:false}));
test('failed refresh retains previously fetched rows and warns stale',()=>assert.deepEqual(resultPolicy({ok:false},[{id:1}]),{value:[{id:1}],stale:true}));
test('failed first load never claims zero',()=>assert.deepEqual(resultPolicy({ok:false},null),{value:null,stale:false}));
test('App must clear immediately in class picker and preserve same-scope refresh',()=>{
 const s=fs.readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 assert.ok(s.includes('decideSnapshot(loadedScopeRef.current,user.id,classId)'));
 assert.match(s,/onChange=\{e=>\{invalidateSelectedClass\(authorizationSeq,requestSeq\);setAuthorizationChecking\(false\);setLoading\(false\);setProblem\(''\);loadedScopeRef\.current=''/);
 assert.match(s,/已清除失败模块的上次结果/);
 assert.match(s,/const recovery=decideReadFailure\(result,\{owned,view\}\)/);
});
