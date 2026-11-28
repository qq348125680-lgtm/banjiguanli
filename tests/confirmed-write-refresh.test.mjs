import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshAfterConfirmedWrite} from '../src/lib/confirmed-write-refresh.mjs';

test('post-write refresh success remains a successful non-throwing follow-up',async()=>{
 assert.deepEqual(await refreshAfterConfirmedWrite(async()=>true),{ok:true});
});
test('post-write rejected refresh cannot be mistaken for uncertain remote mutation',async()=>{
 const error=new Error('network after commit');
 const result=await refreshAfterConfirmedWrite(async()=>{throw error});
 assert.equal(result.ok,false);
 assert.equal(result.reason,'error');
 assert.equal(result.error,error);
});
test('partial/unauthorized/stale refresh cannot be reported as a completed read',async()=>{
 for(const value of [false,undefined,null,0]){
  assert.deepEqual(await refreshAfterConfirmedWrite(async()=>value),{ok:false,reason:'incomplete'});
 }
});
