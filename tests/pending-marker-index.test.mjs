import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectPendingMarker,listAuthorizedPendingMarkers} from '../src/lib/pending-marker-index.mjs';
import {pendingMarkerKey,savePendingMarker} from '../src/lib/pending-write-marker.mjs';
const accountId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherAccount='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const classId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const otherClass='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const secondId='ffffffff-ffff-4fff-8fff-ffffffffffff';
const now=1795900000000;
const scope={accountId,classId,day:'2026-11-28'};
function store(){
 const map=new Map();
 return {
  get length(){return map.size},key(index){return [...map.keys()][index]??null},
  getItem(key){return map.get(key)??null},setItem(key,value){map.set(key,value)},removeItem(key){map.delete(key)}
 };
}
test('finds only current-account authorized scopes without names or notes',()=>{
 const storage=store();
 savePendingMarker(storage,'submit',scope,id,now);
 savePendingMarker(storage,'review',{accountId,classId},secondId,now);
 savePendingMarker(storage,'submit',{accountId:otherAccount,classId,day:scope.day},id,now);
 savePendingMarker(storage,'submit',{accountId,classId:otherClass,day:scope.day},id,now);
 const result=listAuthorizedPendingMarkers(storage,accountId,[classId],now);
 assert.equal(result.unavailable,false);
 assert.equal(result.items.length,2);
 assert.deepEqual(new Set(result.items.map(x=>x.kind)),new Set(['submit','review']));
 assert.ok(result.items.every(x=>x.classId===classId));
 assert.ok(result.items.every(x=>!('note' in x)&&!('name' in x)));
});
test('expired marker keeps its ID for read-only reconciliation; loader does not delete it',()=>{
 const storage=store(),key=pendingMarkerKey('submit',scope);
 storage.setItem(key,JSON.stringify({id,savedAt:1}));
 const marker=inspectPendingMarker(storage,'submit',scope,now);
 assert.deepEqual(marker,{state:'stale',id});
 assert.equal(storage.getItem(key),JSON.stringify({id,savedAt:1}));
 const found=listAuthorizedPendingMarkers(storage,accountId,[classId],now).items;
 assert.equal(found[0].id,id);
 assert.equal(found[0].state,'stale');
});
test('corrupt marker is shown for manual checking, not made retryable',()=>{
 const storage=store(),key=pendingMarkerKey('review',{accountId,classId});
 storage.setItem(key,'{broken');
 const result=listAuthorizedPendingMarkers(storage,accountId,[classId],now);
 assert.equal(result.items.length,1);
 assert.equal(result.items[0].id,null);
 assert.equal(result.items[0].state,'damaged');
 assert.equal(storage.getItem(key),'{broken');
});
test('other account or unauthorized class cannot be displayed',()=>{
 const storage=store();
 savePendingMarker(storage,'submit',scope,id,now);
 assert.equal(listAuthorizedPendingMarkers(storage,otherAccount,[classId],now).items.length,0);
 assert.equal(listAuthorizedPendingMarkers(storage,accountId,[otherClass],now).items.length,0);
});
test('blocked session storage is treated as unavailable without leaking values',()=>{
 assert.equal(listAuthorizedPendingMarkers(null,accountId,[classId]).unavailable,true);
 const broken={get length(){throw Error('blocked')}};
 assert.deepEqual(listAuthorizedPendingMarkers(broken,accountId,[classId]).items,[]);
 assert.equal(listAuthorizedPendingMarkers(broken,accountId,[classId]).unavailable,true);
});
test('unrelated session values and forged key shapes are ignored',()=>{
 const storage=store();
 storage.setItem('unrelated','any');
 storage.setItem('v7:unconfirmed-operation:v1:submit:'+accountId+':'+classId+':bad','{}');
 assert.equal(listAuthorizedPendingMarkers(storage,accountId,[classId],now).items.length,0);
});
