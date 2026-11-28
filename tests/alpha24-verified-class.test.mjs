import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canReadAuthorizedScope} from '../src/lib/snapshot-policy.mjs';
const base={hasBridge:true,hasUser:true,classId:'a',authorizedClassIds:['a'],authorizationBlocked:false};
test('only classes in the verified grant list can be read',()=>{
 assert.equal(canReadAuthorizedScope(base),true);
 assert.equal(canReadAuthorizedScope({...base,authorizedClassIds:['b']}),false);
 assert.equal(canReadAuthorizedScope({...base,authorizedClassIds:[]}),false);
 assert.equal(canReadAuthorizedScope({...base,authorizedClassIds:undefined}),false);
});
test('override never bypasses an ungranted class',()=>{
 assert.equal(canReadAuthorizedScope({...base,authorizationBlocked:true,verifiedOverride:true}),true);
 assert.equal(canReadAuthorizedScope({...base,authorizedClassIds:['b'],authorizationBlocked:true,verifiedOverride:true}),false);
});
test('App gates read and write by the same authorized class membership',()=>{
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 assert.match(app,/const isAuthorizedClass=Boolean\(classId\)\&\&authorizedClassIds\.includes\(classId\)/);
 assert.match(app,/const canWrite=[^;]*isAuthorizedClass/);
 assert.match(app,/authorizedClassIds:freshAuthorizedClassIds\?\?authorizedClassIds/);
 assert.match(app,/const verifiedOverride=Boolean\(freshAuthorizedClassIds\?\.includes\(classId\)\)/);
 assert.match(app,/!isAuthorizedClass\|\|authorizationBlocked\|\|authorizationChecking/);
});
