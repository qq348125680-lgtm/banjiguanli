import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadScopedPanels} from '../src/lib/scope-loader.mjs';
const id='sample';
function setup(fail=[]){
 const panic=x=>fail.includes(x)?Promise.reject(new Error(x+' offline')):null;
 const reader={studentsForOwner:()=>panic('roster')??Promise.resolve([{id:'1',name:'A'}]),submissionsForOwner:()=>panic('reviews')??Promise.resolve({items:[{id:'r1'}],count:1}),mySubmissions:()=>panic('reviews')??Promise.resolve({items:[],count:0}),pendingCountForOwner:()=>panic('pending')??Promise.resolve(3),auditForOwner:()=>panic('audit')??Promise.resolve({items:[],count:0})};
 const writer={roster:()=>panic('roster')??Promise.resolve([{student_id:'2',student_name:'B'}])};
 return {reader,writer};
}
const args=(deps,owned=true,view='archive')=>({...deps,owned,view,classId:id,page:1,pageSize:10,filter:'全部',sanitizeList:xs=>xs.map(x=>({id:x.student_id,name:x.student_name}))});
test('approval query failure cannot erase successfully loaded roster',async()=>{const r=await loadScopedPanels(args(setup(['reviews'])));assert.equal(r.roster.ok,true);assert.deepEqual(r.roster.value,[{id:'1',name:'A'}]);assert.equal(r.reviews.ok,false);assert.equal(r.pending.value,3)});
test('roster failure does not erase review data',async()=>{const r=await loadScopedPanels(args(setup(['roster'])));assert.equal(r.roster.ok,false);assert.equal(r.reviews.ok,true);assert.equal(r.reviews.value.count,1)});
test('optional audit failing cannot hide mandatory panels',async()=>{const r=await loadScopedPanels(args(setup(['audit'])));assert.equal(r.audit.ok,false);assert.equal(r.roster.ok,true);assert.equal(r.reviews.ok,true)});
test('cadre roster is normalized without owner-only query',async()=>{const r=await loadScopedPanels(args(setup(),false,'entry'));assert.deepEqual(r.roster.value,[{id:'2',name:'B'}]);assert.equal(r.pending.value,null);assert.equal(r.audit.value,null)});
test('failed load never claims empty counts',async()=>{const r=await loadScopedPanels(args(setup(['roster','reviews','pending','audit'])));for(const k of ['roster','reviews','pending','audit'])assert.equal(r[k].ok,false)});
test('app only sets successful results and tracks roster loading separately',()=>{const s=fs.readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');assert.match(s,/if\(result\.roster\.ok\)/);assert.match(s,/if\(result\.reviews\.ok\)/);assert.match(s,/rosterLoaded\?'—'/);});
