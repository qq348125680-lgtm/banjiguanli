import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PENDING_KEY_PREFIX,pendingMarkerKey,savePendingMarker,loadPendingMarker,clearPendingMarker,browserSessionStorage} from '../src/lib/pending-write-marker.mjs';
const accountId='11111111-1111-4111-8111-111111111111';
const classId='22222222-2222-4222-8222-222222222222';
const studentId='33333333-3333-4333-8333-333333333333';
const reviewId='44444444-4444-4444-8444-444444444444';
const other='55555555-5555-4555-8555-555555555555';
function memoryStorage(){
 const map=new Map();
 return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),dump:()=>[...map]};
}
test('Alpha47 session pending marker survives simulated component refresh',()=>{
 const st=memoryStorage(),scope={accountId,classId,day:'2026-11-28'};
 assert.equal(savePendingMarker(st,'submit',scope,studentId,10000),true);
 assert.equal(loadPendingMarker(st,'submit',scope,10001),studentId);
 assert.match(st.dump()[0][0],/v7:unconfirmed-operation:v1:submit:/);
 assert.deepEqual(Object.keys(JSON.parse(st.dump()[0][1])).sort(),['id','savedAt']);
 assert.equal(clearPendingMarker(st,'submit',scope),true);
 assert.equal(loadPendingMarker(st,'submit',scope),null);
});
test('Alpha47 marker never restores for unrelated account, class, day or operation',()=>{
 const st=memoryStorage(),scope={accountId,classId,day:'2026-11-28'};
 savePendingMarker(st,'submit',scope,studentId,100);
 assert.equal(loadPendingMarker(st,'submit',{...scope,accountId:other},101),null);
 assert.equal(loadPendingMarker(st,'submit',{...scope,classId:other},101),null);
 assert.equal(loadPendingMarker(st,'submit',{...scope,day:'2026-11-29'},101),null);
 assert.equal(loadPendingMarker(st,'review',scope,101),null);
 savePendingMarker(st,'review',{accountId,classId},reviewId,100);
 assert.equal(loadPendingMarker(st,'review',{accountId,classId},101),reviewId);
});
test('Alpha47 expired, future, corrupt and invalid session markers fail closed',()=>{
 const st=memoryStorage(),scope={accountId,classId,day:'2026-11-28'};
 savePendingMarker(st,'submit',scope,studentId,1000);
 assert.equal(loadPendingMarker(st,'submit',scope,1000+31*86400000),null);
 savePendingMarker(st,'submit',scope,studentId,100000);
 assert.equal(loadPendingMarker(st,'submit',scope,0),null);
 st.setItem(pendingMarkerKey('submit',scope),'{"id":"bad","savedAt":1}');
 assert.equal(loadPendingMarker(st,'submit',scope,10),null);
 assert.equal(savePendingMarker(st,'submit',scope,'not-a-uuid',10),false);
 assert.throws(()=>pendingMarkerKey('submit',{...scope,accountId:'invalid'}));
});
test('Alpha47 no storage privileges or full quota must never bypass account guard',()=>{
 const blocked={getItem(){throw Error('denied')},setItem(){throw Error('denied')},removeItem(){throw Error('denied')}};
 const scope={accountId,classId,day:'2026-11-28'};
 assert.equal(savePendingMarker(blocked,'submit',scope,studentId),false);
 assert.equal(loadPendingMarker(blocked,'submit',scope),null);
 assert.equal(clearPendingMarker(blocked,'submit',scope),false);
 assert.equal(browserSessionStorage(),null);
});
test('Alpha47 actual UI restores, saves and clears pending status under exact login scope',()=>{
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 assert.match(app,/loadPendingMarker\(browserSessionStorage\(\),'submit',\{accountId:user\.id,classId,day\}\)/);
 assert.match(app,/loadPendingMarker\(browserSessionStorage\(\),'review',\{accountId:user\.id,classId\}\)/);
 assert.match(app,/savePendingMarker\(browserSessionStorage\(\),'submit'/);
 assert.match(app,/savePendingMarker\(browserSessionStorage\(\),'review'/);
 assert.match(app,/clearPendingMarker\(browserSessionStorage\(\),'submit'/);
 assert.match(app,/clearPendingMarker\(browserSessionStorage\(\),'review'/);
});
