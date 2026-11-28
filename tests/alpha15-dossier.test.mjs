import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReadOnlyBridge} from '../src/lib/supabase-readonly-adapter.mjs';
const uid='6ee3bb4a-4e37-46f8-93ce-40cc93d31001',cl='22619f4a-12c3-45da-ae24-2cfd93d31002',st='e267ba27-92a4-4f4c-9a42-d88f4d3ac003';
function mock({owner=true,student=true}={}){
 const logs=[];
 const client={auth:{getUser:async()=>({data:{user:{id:uid}}})},from(table){
  const q={select(fields){logs.push({table,fields});return q},eq(){return q},is(){return q},order(){return q},limit(){return Promise.resolve({data:[],error:null})},maybeSingle(){return Promise.resolve({data:student?{id:st,name:'测试学生',student_no:'01'}:null,error:null})},then(resolve,reject){return Promise.resolve({data:table==='classes'&&owner?[{id:cl}]:[],error:null}).then(resolve,reject)}};
  return q;
 }};
 return {bridge:createReadOnlyBridge(client),logs};
}
test('dossier rejects unowned classes before querying student rows',async()=>{const {bridge,logs}=mock({owner:false});await assert.rejects(bridge.dossierForOwner(cl,st),/不是该班级/);assert.equal(logs.filter(x=>x.table==='students').length,0)});
test('dossier rejects students missing from owned class',async()=>{const {bridge}=mock({student:false});await assert.rejects(bridge.dossierForOwner(cl,st),/学生不存在/)});
test('dossier returns 5 safe sections and never requests sensitive columns',async()=>{const {bridge,logs}=mock();const data=await bridge.dossierForOwner(cl,st);assert.equal(Object.keys(data.sections).length,5);assert.deepEqual(Object.keys(data.sections),['考勤','请假','违纪','积分','值日']);assert.ok(logs.every(x=>!/(id_card|phone|home_address|guardian)/.test(x.fields)));});
test('app has dossier entry and date check import; audit extracted',()=>{const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');assert.match(app,/canReviewSubmission,isValidDate/);assert.match(app,/onSelect=\{owned\?setDossierId:undefined\}/);assert.match(app,/<StudentDossierPanel/);assert.match(app,/<AuditPanel/)});
