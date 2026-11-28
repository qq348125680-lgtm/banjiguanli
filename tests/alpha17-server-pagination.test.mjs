import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createReadOnlyBridge} from '../src/lib/supabase-readonly-adapter.mjs';
const u='6ee3bb4a-4e37-46f8-93ce-40cc93d31001';
const c='22619f4a-12c3-45da-ae24-2cfd93d31002';
const s='e267ba27-92a4-4f4c-9a42-d88f4d3ac003';
function setup({owner=true,student=true,errorTable=''}={}){
 const log=[];
 const client={auth:{getUser:async()=>({data:{user:{id:u}},error:null})},from(table){
  let filters=[];
  const q={select(fields,options){log.push({table,fields,options});return q},eq(key,value){filters.push([key,value]);return q},is(){return q},order(){return q},maybeSingle:async()=>({data:student?{id:s}:null,error:null}),range:async(a,b)=>{log.push({table,range:[a,b],filters});return {data:[],count:42,error:table===errorTable?new Error('read failed'):null}},then(resolve,reject){return Promise.resolve({data:table==='classes'&&owner?[{id:c}]:[],error:null}).then(resolve,reject)}};
  return q;
 }};
 return {bridge:createReadOnlyBridge(client),log};
}
test('server pagination uses exact count and range beyond 20 rows',async()=>{
 const {bridge,log}=setup();const r=await bridge.dossierPageForOwner(c,s,'考勤',{page:6,pageSize:10});
 assert.equal(r.count,42);assert.deepEqual(log.find(x=>x.range)?.range,[50,59]);
 assert.deepEqual(log.find(x=>x.range)?.filters,[['student_id',s]]);
 assert.equal(log.find(x=>x.range)?.table,'attendance');
 assert.equal(log.find(x=>x.table==='attendance').options.count,'exact');
});
test('all five categories are allowlisted and names cannot inject table',async()=>{
 const {bridge,log}=setup();for(const name of ['考勤','请假','违纪','积分','值日'])await bridge.dossierPageForOwner(c,s,name);
 assert.deepEqual(log.filter(x=>x.range).map(x=>x.table),['attendance','leave_requests','incidents','point_events','duty_assignments']);
 await assert.rejects(bridge.dossierPageForOwner(c,s,'students'),/分类不合法/);
});
test('does not query business table for unowned class',async()=>{const {bridge,log}=setup({owner:false});await assert.rejects(bridge.dossierPageForOwner(c,s,'考勤'),/不是该班级/);assert.equal(log.filter(x=>x.table==='attendance').length,0)});
test('rejects mismatched or archived student',async()=>{const {bridge,log}=setup({student:false});await assert.rejects(bridge.dossierPageForOwner(c,s,'考勤'),/学生不存在/);assert.equal(log.some(x=>x.table==='attendance'),false)});
test('rejects page injection and oversized offsets',async()=>{const {bridge}=setup();for(const [page,pageSize] of [[0,5],[1,50],[10000000,20],['1',5]])await assert.rejects(bridge.dossierPageForOwner(c,s,'考勤',{page,pageSize}),/分页参数不合法/)});
test('propagates database failure, never returns false zero',async()=>{const {bridge}=setup({errorTable:'attendance'});await assert.rejects(bridge.dossierPageForOwner(c,s,'考勤'),/read failed/)});
test('React UI requests server pages rather than slicing loaded 20 rows',()=>{const panel=fs.readFileSync(new URL('../src/components/StudentDossierPanel.tsx',import.meta.url),'utf8');assert.match(panel,/fetchPage\(name,page,pageSize\)/);assert.doesNotMatch(panel,/dossierPage\(/);assert.match(panel,/seq\.current/);});
