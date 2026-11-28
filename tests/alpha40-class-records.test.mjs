import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CLASS_RECORDS,CLASS_RECORD_KINDS,validateRecordPage,validateRecordDates,describeClassRecord,escapeCsvCell,exportRecordPageCsv} from '../src/lib/class-records.mjs';
import {createReadOnlyBridge} from '../src/lib/supabase-readonly-adapter.mjs';
const owner='11111111-1111-4111-8111-111111111111';
const classId='22222222-2222-4222-8222-222222222222';
const studentId='33333333-3333-4333-8333-333333333333';
function mockedClient({owned=true,student=true}={}){
 const calls=[];
 const rows={
  classes:owned?[{id:classId,name:'测试班',owner_id:owner}]:[],
  students:student?[{id:studentId,name:'学生甲',student_no:'01',class_id:classId}]:[],
  leave_requests:[{id:'a',student_id:studentId,start_on:'2026-11-20',status:'已批准',category:'事假'}],
  family_contacts:[{id:'b',student_id:studentId,contacted_on:'2026-11-21',method:'电话'}]
 };
 function chain(table){
  const state={table,ops:[]};
  const q={
   select(fields,opts){state.ops.push(['select',fields]);state.opts=opts;return q},
   eq(key,value){state.ops.push(['eq',key,value]);return q},
   is(key,value){state.ops.push(['is',key,value]);return q},
   in(key,value){state.ops.push(['in',key,value]);return q},
   gte(key,value){state.ops.push(['gte',key,value]);return q},
   lte(key,value){state.ops.push(['lte',key,value]);return q},
   order(key,opts){state.ops.push(['order',key]);return q},
   range(a,b){state.ops.push(['range',a,b]);return q},
   then(resolve,reject){
    calls.push(state);
    let data=rows[table]??[];
    for(const [op,key,val] of state.ops){
     if(op==='eq')data=data.filter(v=>v[key]===val);
     if(op==='in')data=data.filter(v=>val.includes(v[key]));
    }
    return Promise.resolve({data,error:null,count:data.length}).then(resolve,reject);
   }
  };
  return q;
 }
 return {client:{auth:{getUser:async()=>({data:{user:{id:owner}},error:null})},from:chain},calls};
}
test('Alpha40 six categories match schema and have safe query fields',()=>{
 assert.deepEqual(CLASS_RECORD_KINDS,['考勤','请假','违纪','积分','值日','家校沟通']);
 for(const kind of CLASS_RECORD_KINDS){
  const def=CLASS_RECORDS[kind];assert.ok(def.table);assert.ok(def.fields.includes('student_id'));
  assert.doesNotMatch(def.fields,/id_card|guardian_phone|home_address|phone/);
 }
});
test('Alpha40 rejects unknown categories, malformed pagination, and extra-large pages',()=>{
 assert.throws(()=>validateRecordPage('fake',1,10));
 assert.throws(()=>validateRecordPage('考勤',0,10));
 assert.throws(()=>validateRecordPage('考勤',1,100));
 assert.throws(()=>validateRecordPage('考勤',10001,5));
});
test('Alpha40 owner reader restricts student IDs and reports exact server total',async()=>{
 const {client,calls}=mockedClient();const bridge=createReadOnlyBridge(client);
 const result=await bridge.classRecordsForOwner(classId,'请假',{page:1,pageSize:5});
 assert.equal(result.count,1);assert.equal(result.items[0].student_id,studentId);
 const q=calls.find(x=>x.table==='leave_requests');
 assert.ok(q.ops.some(([op,key,ids])=>op==='in'&&key==='student_id'&&ids.length===1&&ids[0]===studentId));
 assert.ok(q.ops.some(([op,a,b])=>op==='range'&&a===0&&b===4));
});
test('Alpha40 no owner permission means no activity queries',async()=>{
 const {client,calls}=mockedClient({owned:false});const bridge=createReadOnlyBridge(client);
 await assert.rejects(()=>bridge.classRecordsForOwner(classId,'家校沟通',{page:1,pageSize:10}));
 assert.equal(calls.some(x=>x.table==='family_contacts'),false);
});
test('Alpha40 no current student returns empty and does not query sensitive contacts',async()=>{
 const {client,calls}=mockedClient({student:false});const bridge=createReadOnlyBridge(client);
 const result=await bridge.classRecordsForOwner(classId,'家校沟通',{page:1,pageSize:10});
 assert.equal(result.count,0);assert.equal(calls.some(x=>x.table==='family_contacts'),false);
});
test('Alpha40 page never fabricates missing fields or reveals family identity columns',()=>{
 const info=describeClassRecord('家校沟通',{contacted_on:'2026-11-20',method:'电话'});
 assert.equal(info.date,'2026-11-20');assert.equal(info.description,'电话');
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 const panel=readFileSync(new URL('../src/components/ClassRecordsPanel.tsx',import.meta.url),'utf8');
 assert.match(app,/view==='records'&&\(!owned\?<><div className="student-center-tabs"/);
 assert.match(app,/recordTab!=='cases'&&<EventCenterPanel/);
 assert.match(app,/recordTab==='cases'&&<EventCaseBoard/);
 assert.match(app,/recordTab==='cases'&&<EventCaseBoard/);
 assert.match(app,/recordTab==='activity'&&<ClassRecordsPanel/);
 assert.match(app,/recordTab==='rules'&&<PointRulesPanel/);
 assert.match(panel,/仅班主任/);
 assert.match(panel,/seq.current\+\+/);
 assert.doesNotMatch(panel,/\.insert\(|\.update\(|\.delete\(/);
});

test('Alpha40 date filters only accept real ISO dates in increasing order',()=>{
 assert.deepEqual(validateRecordDates('2026-11-01','2026-11-30'),{startOn:'2026-11-01',endOn:'2026-11-30'});
 assert.throws(()=>validateRecordDates('2026-02-30',''));
 assert.throws(()=>validateRecordDates('2026-12-01','2026-11-30'));
});
test('Alpha40 owner reader binds date range and selected student safely',async()=>{
 const {client,calls}=mockedClient();const bridge=createReadOnlyBridge(client);
 await bridge.classRecordsForOwner(classId,'请假',{page:1,pageSize:5,studentId,startOn:'2026-11-01',endOn:'2026-11-30'});
 const q=calls.find(x=>x.table==='leave_requests');
 assert.ok(q.ops.some(([op,key,val])=>op==='gte'&&key==='start_on'&&val==='2026-11-01'));
 assert.ok(q.ops.some(([op,key,val])=>op==='lte'&&key==='start_on'&&val==='2026-11-30'));
 await assert.rejects(()=>bridge.classRecordsForOwner(classId,'请假',{page:1,pageSize:5,studentId:'99999999-9999-4999-8999-999999999999'}));
});
test('Alpha40 CSV protects spreadsheet formulas and refuses family contact export',()=>{
 const cell=escapeCsvCell('=HYPERLINK("https://example.com")');
 assert.ok(cell.startsWith('"\'='));
 const csv=exportRecordPageCsv('违纪',[{id:'i',student_id:studentId,happened_on:'2026-11-20',category:'课堂',description:'=1+1',points:-2}],[{id:studentId,name:'学生甲'}]);
 assert.ok(csv.charCodeAt(0)===0xFEFF);
 assert.match(csv,/学生甲/);
 assert.match(csv,/课堂 · 分值 -2 · =1\+1/);
 assert.throws(()=>exportRecordPageCsv('家校沟通',[],[]));
});
test('Alpha40 record UI confines export to loaded page and blocks family export',()=>{
 const source=readFileSync(new URL('../src/components/ClassRecordsPanel.tsx',import.meta.url),'utf8');
 assert.match(source,/kind==='家校沟通'/);
 assert.match(source,/exportRecordPageCsv\(kind,result.items,result.students\)/);
 assert.match(source,/queryKey=/);
 assert.match(source,/按学生筛选班务记录/);
});
