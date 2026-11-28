import test from 'node:test';
import assert from 'node:assert/strict';
import {createEventCaseApi} from '../src/lib/event-case-api.mjs';
const cls='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const student='aaaaaaaa-0000-4000-8000-000000000001';
const uuid='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const reportRows=[
 {metric:'created',item:'考勤',amount:1},
 {metric:'action',item:'创建',amount:1}
];
const row={id:uuid,class_id:cls,student_id:student,kind:'家校沟通',
 title:'家校沟通回访',status:'已结案',assigned_to:null,created_by:uuid,
 created_at:'2026-11-25T02:00:00Z',closed_at:'2026-11-28T04:30:00Z'};
function fake({owner=true,error=null,rows=[row],count=1}={}){
 const queries=[],rpcCalls=[];
 const client={
  auth:{getUser:async()=>({data:{user:{id:uuid}},error:null})},
  rpc:async(name,p)=>{rpcCalls.push({name,p});return {data:reportRows,error}},
  from(table){
   const meta={table,clauses:[],orders:[],fields:null,options:null};queries.push(meta);
   const fluent={
    select(fields,options){meta.fields=fields;meta.options=options;return fluent},
    eq(key,v){meta.clauses.push(['eq',key,v]);return fluent},
    gte(key,v){meta.clauses.push(['gte',key,v]);return fluent},
    lt(key,v){meta.clauses.push(['lt',key,v]);return fluent},
    order(key,options){meta.orders.push([key,options]);return fluent},
    maybeSingle:async()=>({data:owner?{id:cls}:null,error}),
    range:async(start,end)=>{meta.range=[start,end];return {data:rows,error,count}}
   };return fluent;
  }
 };
 return {api:createEventCaseApi(client),queries,rpcCalls};
}
test('结案档案只包含当前班级的服务端已结案记录，并按结案时间排序分页',async()=>{
 const m=fake();
 const data=await m.api.closedArchive(cls,{page:2,pageSize:10,kind:'家校沟通',from:'2026-11-22',to:'2026-11-28'});
 assert.equal(data.count,1);
 assert.equal(data.items[0].title,'家校沟通回访');
 const q=m.queries.find(q=>q.table==='v7_event_cases');
 for(const [op,key,v] of [['eq','class_id',cls],['eq','status','已结案'],['eq','kind','家校沟通'],
 ['gte','closed_at','2026-11-22T00:00:00+08:00'],['lt','closed_at','2026-11-29T00:00:00+08:00']]){
  assert.ok(q.clauses.some(x=>x[0]===op&&x[1]===key&&x[2]===v),key);
 }
 assert.deepEqual(q.range,[10,19]);
 assert.deepEqual(q.orders.map(([k])=>k),['closed_at','id']);
});
test('停用或非班主任账号不得读取全班结案档案',async()=>{
 const m=fake({owner:false});
 await assert.rejects(()=>m.api.closedArchive(cls),/不是该班班主任/);
 assert.equal(m.queries.filter(x=>x.table==='v7_event_cases').length,0);
});
test('跨班、未结案、无结案时间及不完整计数不能展示为正式档案',async()=>{
 for(const r of [
  {...row,class_id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'},
  {...row,status:'处理中'},
  {...row,closed_at:null},
  {...row,kind:'考勤'}
 ])await assert.rejects(()=>fake({rows:[r]}).api.closedArchive(cls,{kind:'家校沟通'}));
 await assert.rejects(()=>fake({count:null}).api.closedArchive(cls),/未完整/);
 await assert.rejects(()=>fake({error:{code:'42501'}}).api.closedArchive(cls));
});
test('结案档案范围校验完整，不能用无效日期或类别绕过查询',async()=>{
 const x=fake().api;
 for(const params of [
  {page:0},{pageSize:100},{kind:'不存在的类别'},
  {from:'2026-11-31'},{to:'not-a-date'},
  {from:'2026-12-01',to:'2026-11-01'}
 ])await assert.rejects(()=>x.closedArchive(cls,params));
});
test('周报仅通过带班级和周一参数的数据库统计 RPC 读取',async()=>{
 const m=fake();
 const rows=await m.api.weeklyReport(cls,'2026-11-23');
 assert.deepEqual(rows,reportRows);
 assert.deepEqual(m.rpcCalls,[{name:'v7_weekly_case_report',
  p:{p_class_id:cls,p_week_start:'2026-11-23'}}]);
 await assert.rejects(()=>m.api.weeklyReport(cls,'not-date'));
 await assert.rejects(()=>fake({error:{code:'42501'}}).api.weeklyReport(cls,'2026-11-23'));
});
