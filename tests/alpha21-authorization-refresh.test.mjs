import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {reconcileAuthorization} from '../src/lib/snapshot-policy.mjs';
const state={owned:[{id:'class-a'}],delegated:[{class_id:'class-b'}]};
test('retain a currently authorized class',()=>assert.deepEqual(reconcileAuthorization(state,'class-b'),{authorized:true,nextClassId:'class-b'}));
test('revoked class must switch to an allowed class',()=>assert.deepEqual(reconcileAuthorization(state,'class-c'),{authorized:false,nextClassId:'class-a'}));
test('no remaining class clears selection',()=>assert.deepEqual(reconcileAuthorization({owned:[],delegated:[]},'class-a'),{authorized:false,nextClassId:''}));
test('authorization data missing denies access',()=>assert.deepEqual(reconcileAuthorization({},'class-a'),{authorized:false,nextClassId:''}));
test('refresh must verify authorization before loading',()=>{
 const app=fs.readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 const fn=app.slice(app.indexOf('async function verifiedRefresh()'),app.indexOf('async function login()'));
 assert.ok(fn.indexOf('authorizedClasses()')>=0);
 assert.ok(fn.indexOf('authorizedClasses()')<fn.indexOf('await loadData(['));
 assert.match(fn,/setRoster\(\[\]\)/);
 assert.match(fn,/setDossierId\(''\)/);
 assert.match(fn,/setReviewNotes\(\{\}\)/);
 assert.match(app,/onClick=\{\(\)=>void verifiedRefresh\(\)\}/);
});
