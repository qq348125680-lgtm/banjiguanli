import test from 'node:test';
import assert from 'node:assert/strict';
import {createEventCaseApi,validateCaseInput,CASE_STATES} from '../src/lib/event-case-api.mjs';
const classId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const studentId='aaaaaaaa-0000-4000-8000-000000000001';
const caseId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const sourceId='a1111111-1111-4111-8111-111111111111';
const requestKey='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const base={classId,studentId,kind:'考勤',title:'迟到需要跟进',description:'教师核对',requestKey};
const goodLink={case_id:caseId,class_id:classId,student_id:studentId,source_kind:'考勤',source_record_id:sourceId};
function mockClient(sourceRows=[goodLink],counts={待分派:1,处理中:2,待复核:3,已结案:4}){
 const calls=[],rpcCalls=[];
 const client={
  auth:{getUser:async()=>({data:{user:{id:'11111111-1111-4111-8111-111111111111'}},error:null})},
  rpc:async(name,params)=>{rpcCalls.push({name,params});return {data:caseId,error:null}},
  from(table){
   const q={table,fields:'',filters:[],ids:[],opts:{}};calls.push(q);
   const chain={
    select(fields,options){q.fields=fields;q.opts=options??{};return chain},
    eq(key,value){q.filters.push([key,value]);return chain},
    in(key,values){q.ids=values;q.inKey=key;return chain},
    limit(n){q.limit=n;return Promise.resolve({data:sourceRows,error:null})},
    then(resolve){const st=q.filters.find(x=>x[0]==='status')?.[1];return resolve({count:counts[st]??null,error:null})}
   };return chain;
  }
 };
 return {api:createEventCaseApi(client),calls,rpcCalls};
}
test('linked case creation uses atomic backend RPC with original UUID; ordinary create unchanged',async()=>{
 const {api,rpcCalls}=mockClient();
 await api.create({...base,sourceRecordId:sourceId});
 assert.equal(rpcCalls[0].name,'v7_create_linked_event_case');
 assert.equal(rpcCalls[0].params.p_source_record_id,sourceId);
 await api.create(base);
 assert.equal(rpcCalls[1].name,'v7_create_event_case');
 assert.equal('p_source_record_id' in rpcCalls[1].params,false);
});
test('link validation rejects invalid UUID and free-form source types',()=>{
 assert.equal(validateCaseInput({...base,sourceRecordId:sourceId}).p_source_record_id,sourceId);
 assert.throws(()=>validateCaseInput({...base,sourceRecordId:'not-a-uuid'}));
 assert.throws(()=>validateCaseInput({...base,kind:'其他',sourceRecordId:sourceId}));
});
test('teacher source lookup only accepts matching source kind, record and student identity',async()=>{
 const {api,calls}=mockClient();
 const links=await api.sourceLinks(classId,[{studentId,kind:'考勤',sourceId}]);
 assert.equal(links.length,1);
 const q=calls.find(x=>x.table==='v7_event_case_sources');
 assert.ok(q.filters.some(([k,v])=>k==='class_id'&&v===classId));
 assert.deepEqual(q.ids,[sourceId]);
 assert.equal(q.inKey,'source_record_id');
 const invalid=mockClient([{...goodLink,student_id:'aaaaaaaa-0000-4000-8000-000000000002'}]).api;
 await assert.rejects(()=>invalid.sourceLinks(classId,[{studentId,kind:'考勤',sourceId}]),/不匹配/);
 const invalidKind=mockClient([{...goodLink,source_kind:'家校沟通'}]).api;
 await assert.rejects(()=>invalidKind.sourceLinks(classId,[{studentId,kind:'考勤',sourceId}]));
});
test('source lookup enforces 120-item bound and rejects error instead of silently showing no links',async()=>{
 const {api}=mockClient();
 await assert.rejects(()=>api.sourceLinks(classId,new Array(121).fill({studentId,kind:'考勤',sourceId})),/上限/);
 await assert.rejects(()=>api.sourceLinks(classId,[{studentId,kind:'考勤',sourceId:'malformed'}]));
});
test('student case summary totals are exact server status counts, not page-limited',async()=>{
 const {api,calls}=mockClient();
 const stats=await api.studentSummary(classId,studentId);
 assert.equal(stats.total,10);
 assert.deepEqual(stats.counts,{'待分派':1,'处理中':2,'待复核':3,'已结案':4});
 assert.equal(calls.filter(q=>q.table==='v7_event_cases').length,4);
 for(const q of calls){
  assert.equal(q.opts.count,'exact');
  assert.equal(q.opts.head,true);
  assert.ok(q.filters.some(([k,v])=>k==='student_id'&&v===studentId));
  assert.ok(q.filters.some(([k,v])=>k==='class_id'&&v===classId));
 }
 const bad=mockClient([],{'待分派':1,'处理中':2,'待复核':null,'已结案':4}).api;
 await assert.rejects(()=>bad.studentSummary(classId,studentId),/未读取完整/);
});
