import test from 'node:test';
import assert from 'node:assert/strict';
import {createGuardianLinksApi,validateGuardianInput,validateGuardianStatus,maskGuardianPhone,GUARDIAN_STATUSES} from '../src/lib/guardian-links-api.mjs';
const classId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const studentId='aaaaaaaa-0000-4000-8000-000000000001';
const key='99999999-9999-4999-8999-999999999999';
const linkId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
test('guardian intake requires explicit student, name, relationship, phone and request UUID',()=>{
 const input={classId,studentId,name:' 测试监护人 ',relation:'母亲',phone:' 13800000001 ',requestKey:key};
 const params=validateGuardianInput(input);
 assert.equal(params.p_name,'测试监护人');
 assert.equal(params.p_phone,'13800000001');
 assert.equal(params.p_request_key,key);
 for(const change of [
  {classId:'other'}, {studentId:'invalid'}, {requestKey:'x'},
  {name:'A'}, {relation:'未知自动识别'}, {phone:'123'}, {phone:'phone-number'}
 ])assert.throws(()=>validateGuardianInput({...input,...change}));
});
test('guardian phone is masked unless teacher explicitly reveals one record',()=>{
 assert.equal(maskGuardianPhone('13800000001'),'138••••0001');
 assert.equal(maskGuardianPhone(''),'••••');
 assert.deepEqual(GUARDIAN_STATUSES,['待核实','已核实','已失效']);
});
test('verification, deactivation and re-verification require manual reason and valid ID',()=>{
 assert.deepEqual(validateGuardianStatus(linkId,'verify',' 已核实 '),{p_id:linkId,p_action:'verify',p_note:'已核实'});
 for(const bad of [
  [linkId,'guess','说明'],[linkId,'verify',''],['invalid','verify','手工核对'],[linkId,'deactivate','x']
 ])assert.throws(()=>validateGuardianStatus(...bad));
});
function mock({result=linkId,role='owner'}={}){
 const queries=[],rpcCalls=[];
 const who=role==='owner'?'11111111-1111-4111-8111-111111111111':'33333333-3333-4333-8333-333333333333';
 const client={
  auth:{getUser:async()=>({data:{user:{id:who}},error:null})},
  rpc:async(name,params)=>{rpcCalls.push({name,params});return {data:result,error:null}},
  from(table){
   const q={table,filters:[],columns:''};queries.push(q);
   const chain={
    select(columns){q.columns=columns;return chain},
    eq(k,v){q.filters.push([k,v]);return chain},
    order(){return chain},
    range(a,b){q.range=[a,b];return Promise.resolve({data:[],count:0,error:null})},
    limit(n){q.limit=n;return Promise.resolve({data:[],error:null})},
    maybeSingle(){return Promise.resolve({data:null,error:null})}
   };return chain;
  }
 };
 return {api:createGuardianLinksApi(client),queries,rpcCalls};
}
test('create relationship invokes idempotent server RPC rather than direct row write',async()=>{
 const {api,rpcCalls}=mock();
 const id=await api.create({classId,studentId,name:'测试家长甲',relation:'父亲',phone:'13800000001',requestKey:key});
 assert.equal(id,linkId);
 assert.equal(rpcCalls[0].name,'v7_create_guardian_link');
 assert.equal(rpcCalls[0].params.p_student_id,studentId);
 assert.equal(rpcCalls[0].params.p_request_key,key);
});
test('owner-scoped listings filter both class and selected student on server',async()=>{
 const {api,queries}=mock();
 const list=await api.list(classId,{studentId,status:'待核实',page:2,pageSize:10});
 assert.equal(list.count,0);
 const q=queries.find(x=>x.table==='v7_guardian_links');
 assert.ok(q.filters.some(([k,v])=>k==='class_id'&&v===classId));
 assert.ok(q.filters.some(([k,v])=>k==='student_id'&&v===studentId));
 assert.ok(q.filters.some(([k,v])=>k==='verification_status'&&v==='待核实'));
 assert.deepEqual(q.range,[10,19]);
});
test('read-only request recovery is owner-specific and preserves request identity',async()=>{
 const {api,queries}=mock();
 assert.equal(await api.findByRequestKey(classId,key),null);
 const q=queries.find(x=>x.table==='v7_guardian_links');
 assert.ok(q.filters.some(([k,v])=>k==='request_key'&&v===key));
 assert.ok(q.filters.some(([k,v])=>k==='created_by'));
});
test('guardian action history excludes raw phone and returns only procedural fields',async()=>{
 const {api,queries}=mock();
 await api.history(classId,linkId);
 const q=queries.find(x=>x.table==='v7_guardian_link_history');
 assert.match(q.columns,/actor_id,action,from_status,to_status,note,created_at/);
 assert.doesNotMatch(q.columns,/phone|contact_name/i);
 assert.ok(q.filters.some(([k,v])=>k==='link_id'&&v===linkId));
});
test('unknown server mutation results fail closed',async()=>{
 const {api}=mock({result:{id:linkId,status:'已核实'}});
 assert.equal((await api.change(linkId,'verify','班主任已核实')).status,'已核实');
 const {api:invalid}=mock({result:{id:linkId,status:'不是状态'}});
 await assert.rejects(()=>invalid.change(linkId,'verify','班主任已核实'));
});
