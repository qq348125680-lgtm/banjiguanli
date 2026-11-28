import test from 'node:test';
import assert from 'node:assert/strict';
import {pendingLabel,canSubmitAsDelegate,isValidDate,auditSummary} from '../src/lib/domain.mjs';
import {createReadOnlyBridge} from '../src/lib/supabase-readonly-adapter.mjs';
const UUID='11111111-1111-4111-8111-111111111111';
test('pending count respects unknown vs zero',()=>{assert.equal(pendingLabel(null),'—');assert.equal(pendingLabel(0),'0');assert.equal(pendingLabel(12),'12');assert.equal(pendingLabel(undefined),'—');});
test('delegate submission denied for owner, disabled role or writes disabled',()=>{
 const d=[{class_id:UUID,enabled:true}];
 assert.equal(canSubmitAsDelegate({owned:false,delegated:d,classId:UUID,writesEnabled:true}),true);
 assert.equal(canSubmitAsDelegate({owned:true,delegated:d,classId:UUID,writesEnabled:true}),false);
 assert.equal(canSubmitAsDelegate({owned:false,delegated:d,classId:UUID,writesEnabled:false}),false);
 assert.equal(canSubmitAsDelegate({owned:false,delegated:[{class_id:UUID,enabled:false}],classId:UUID,writesEnabled:true}),false);
});
test('dates reject impossible day',()=>{assert.equal(isValidDate('2026-02-30'),false);assert.equal(isValidDate('2026-11-26'),true);});
test('audit projection excludes sensitive old_data/new_data',()=>{
 const item=auditSummary({id:1,action:'UPDATE',table_name:'attendance',row_id:UUID,actor_id:UUID,changed_at:'now',old_data:{phone:'private'},new_data:{id_card:'private'}});
 assert.equal(Object.hasOwn(item,'old_data'),false);assert.equal(Object.hasOwn(item,'new_data'),false);
});
function mockClient(){
 let requests=[];
 function builder(table){const q={select(columns,options){requests.push({table,columns,options});return q},eq(){return q},order(){return q},range(){return Promise.resolve({data:[{id:7,action:'UPDATE',table_name:'attendance',row_id:'x',actor_id:null,changed_at:'2026-11-26'}],error:null,count:1})},then(resolve){resolve({data:[],error:null,count:0})}};return q;}
 return {requests,client:{auth:{getUser:async()=>({data:{user:{id:UUID}}})},from:builder}};
}
test('read-only audit uses minimal select and validates class ownership',async()=>{
 const {client,requests}=mockClient();const reader=createReadOnlyBridge(client);
 // owner verification normally consults the owned classes; mock returns [] -> deny.
 await assert.rejects(reader.auditForOwner(UUID),/不是该班级/);
 assert.equal(requests.some(r=>r.table==='operation_audit'),false);
});
