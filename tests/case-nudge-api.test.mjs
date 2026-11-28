import test from 'node:test';
import assert from 'node:assert/strict';
import {validateNudgeInput,verifyPendingNudges} from '../src/lib/case-nudge-model.mjs';
import {createEventCaseApi} from '../src/lib/event-case-api.mjs';

const cls='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const caseId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const owner='11111111-1111-4111-8111-111111111111';
const cadre='33333333-3333-4333-8333-333333333333';
const nudgeId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const nudge={id:nudgeId,class_id:cls,case_id:caseId,target_user_id:cadre,note:'请按时核实，并反馈处理情况',created_at:'2026-11-29T09:00:00Z',resolved_at:null};

test('催办必须有工单编号与2-500字人工说明',()=>{
 assert.deepEqual(validateNudgeInput(caseId,' 尽快完成 '),{p_case_id:caseId,p_note:'尽快完成'});
 for(const [id,note] of [
  ['invalid','催办原因'],[caseId,''],[caseId,'a'],[caseId,'x'.repeat(501)],
  [caseId,undefined],[null,'有催办说明']
 ]) assert.throws(()=>validateNudgeInput(id,note));
});
test('催办列表只能按授权班级、负责人和未回应状态展示，失败不是0',()=>{
 const out=verifyPendingNudges({data:[nudge],count:8,error:null},cls,cadre,false);
 assert.equal(out.count,8);assert.equal(out.items.length,1);
 assert.deepEqual(out.items[0],{id:nudgeId,caseId,targetUserId:cadre,note:nudge.note,createdAt:nudge.created_at});
 for(const bad of [
  {data:[{...nudge,class_id:'other'}],count:1,error:null},
  {data:[{...nudge,target_user_id:owner}],count:1,error:null},
  {data:[{...nudge,resolved_at:'2026-11-29T10:00Z'}],count:1,error:null},
  {data:[],count:null,error:null},
  {data:[],count:0,error:{code:'42501'}},
  {data:[nudge],count:0,error:null}
 ])assert.throws(()=>verifyPendingNudges(bad,cls,cadre,false));
 assert.doesNotThrow(()=>verifyPendingNudges({data:[nudge],count:1,error:null},cls,owner,true));
});
function createMock(role='owner'){
 const calls=[],rpcCalls=[];
 const userId=role==='owner'?owner:cadre;
 const client={
  auth:{getUser:async()=>({data:{user:{id:userId}},error:null})},
  rpc:async(name,params)=>{
   rpcCalls.push({name,params});
   return {data:{id:nudgeId,case_id:caseId,status:'待反馈'},error:null};
  },
  from(table){
   const item={table,clauses:[]};calls.push(item);
   const chain={
    select(fields,options){item.fields=fields;item.options=options??{};return chain},
    eq(k,v){item.clauses.push(['eq',k,v]);return chain},
    is(k,v){item.clauses.push(['is',k,v]);return chain},
    order(){return chain},
    limit(n){item.limit=n;return Promise.resolve({data:role==='owner'?[nudge]:[nudge],count:1,error:null})},
    maybeSingle(){
     return Promise.resolve({data:table==='classes'&&role==='owner'?{id:cls}:table==='class_delegates'&&role==='cadre'?{id:caseId}:null,error:null});
    }
   };return chain;
  }
 };
 return {api:createEventCaseApi(client),calls,rpcCalls};
}
test('班主任催办通过单个数据库事务 RPC，且校验服务器返回',async()=>{
 const {api,rpcCalls}=createMock();
 const result=await api.sendNudge(caseId,'请完成跟进');
 assert.equal(result.status,'待反馈');
 assert.deepEqual(rpcCalls,[{name:'v7_send_case_nudge',params:{p_case_id:caseId,p_note:'请完成跟进'}}]);
});
test('班主任查看全班催办，干部只能查看分配给自己的未回应催办',async()=>{
 const a=createMock('owner'),b=createMock('cadre');
 const ownerResult=await a.api.pendingNudges(cls);
 const cadreResult=await b.api.pendingNudges(cls);
 assert.equal(ownerResult.owned,true);assert.equal(cadreResult.owned,false);
 assert.equal(ownerResult.count,1);assert.equal(cadreResult.count,1);
 const ownerQuery=a.calls.find(q=>q.table==='v7_case_nudges');
 const cadreQuery=b.calls.find(q=>q.table==='v7_case_nudges');
 assert.ok(ownerQuery.clauses.some(([op,key,value])=>op==='is'&&key==='resolved_at'&&value===null));
 assert.equal(ownerQuery.clauses.some(([op,key])=>op==='eq'&&key==='target_user_id'),false);
 assert.ok(cadreQuery.clauses.some(([op,key,value])=>op==='eq'&&key==='target_user_id'&&value===cadre));
 assert.equal(cadreQuery.options.count,'exact');
});
test('无有效班干部授权时，拒绝读取催办而非显示无任务',async()=>{
 const {api}=createMock('owner');
 assert.equal((await api.pendingNudges(cls)).count,1);
 const userId=cadre;
 const client={
  auth:{getUser:async()=>({data:{user:{id:userId}},error:null})},
  from(table){return {select(){return this},eq(){return this},maybeSingle:async()=>({data:null,error:null})}},
  rpc:async()=>({data:null,error:null})
 };
 await assert.rejects(()=>createEventCaseApi(client).pendingNudges(cls),/不在当前授权班级/);
});
