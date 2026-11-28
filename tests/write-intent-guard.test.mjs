import test from 'node:test';
import assert from 'node:assert/strict';
import {beginWriteIntent,finishKnownWrite,hasConfirmedAttendance} from '../src/lib/write-intent-guard.mjs';
import {loadPendingMarker,pendingMarkerKey} from '../src/lib/pending-write-marker.mjs';

const accountId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const classId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const studentId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const otherStudent='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const reviewId='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const scope={accountId,classId,day:'2026-11-28'};
function storage(){
 const m=new Map();
 return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};
}

test('write intent is saved before network work and survives simulated refresh',()=>{
 const s=storage();
 assert.deepEqual(beginWriteIntent(s,'submit',scope,studentId),{ok:true,id:studentId});
 assert.equal(loadPendingMarker(s,'submit',scope),studentId);
 assert.deepEqual(beginWriteIntent(s,'submit',scope,otherStudent),{ok:false,reason:'pending',id:studentId});
 assert.equal(loadPendingMarker(s,'submit',scope),studentId);
});
test('unknown outcome is never automatically cleared; settled outcome clears matching marker only',()=>{
 const s=storage();
 beginWriteIntent(s,'review',scope,reviewId);
 assert.equal(finishKnownWrite(s,'review',scope,otherStudent),false);
 assert.equal(loadPendingMarker(s,'review',scope),reviewId);
 assert.equal(finishKnownWrite(s,'review',scope,reviewId),true);
 assert.equal(loadPendingMarker(s,'review',scope),null);
});
test('unavailable or denied session storage blocks writes',()=>{
 assert.equal(beginWriteIntent(null,'submit',scope,studentId).reason,'storage');
 const blocked={getItem:()=>null,setItem:()=>{throw Error('storage disabled')},removeItem:()=>{}};
 assert.equal(beginWriteIntent(blocked,'submit',scope,studentId).reason,'storage');
 const silent={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
 assert.equal(beginWriteIntent(silent,'submit',scope,studentId).reason,'storage');
});
test('different days and classes remain independently scoped',()=>{
 const s=storage();const tomorrow={...scope,day:'2026-11-29'};
 beginWriteIntent(s,'submit',scope,studentId);
 assert.deepEqual(beginWriteIntent(s,'submit',tomorrow,otherStudent),{ok:true,id:otherStudent});
 assert.notEqual(pendingMarkerKey('submit',scope),pendingMarkerKey('submit',tomorrow));
 assert.equal(loadPendingMarker(s,'submit',scope),studentId);
 assert.equal(loadPendingMarker(s,'submit',tomorrow),otherStudent);
});
test('only confirmed attendance unlocks reconciliation; past rejection never does',()=>{
 const old={entry_type:'考勤',status:'已驳回'};
 assert.equal(hasConfirmedAttendance([]),false);
 assert.equal(hasConfirmedAttendance([old]),false);
 assert.equal(hasConfirmedAttendance([{entry_type:'考勤',status:'未知'}]),false);
 assert.equal(hasConfirmedAttendance([{entry_type:'请假',status:'待审核'}]),false);
 assert.equal(hasConfirmedAttendance([old,{entry_type:'考勤',status:'待审核'}]),true);
 assert.equal(hasConfirmedAttendance([{entry_type:'考勤',status:'已通过'}]),true);
});
