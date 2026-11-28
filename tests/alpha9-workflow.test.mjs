import assert from 'node:assert/strict';
import {createSafeWorkflow} from '../src/lib/safe-workflow.mjs';
const U='123e4567-e89b-42d3-a456-426614174000';
const V='123e4567-e89b-42d3-a456-426614174001';
let calls=[];
const client={auth:{getUser:async()=>({data:{user:{id:U}},error:null})},
 rpc:async (name,args)=>{calls.push({name,args});return {data:{status:'已通过'},error:null}},
 from:(table)=>({insert:(payload)=>({select:()=>({single:async()=>{calls.push({table,payload});return{data:{id:V},error:null}}})})})};
const api=createSafeWorkflow(client);
const valid={classId:U,studentId:V,entryType:'考勤',date:'2026-11-26',status:'迟到',note:'测试'};
await assert.rejects(api.submit({...valid,entryType:'成长积分'}),/仅开放考勤/);
await assert.rejects(api.submit({...valid,status:'乱填'}),/考勤状态/);
await assert.rejects(api.submit({...valid,studentId:'bad'}),/UUID/);
await assert.rejects(api.submit({...valid,date:'bad'}),/日期/);
await assert.rejects(api.submit({...valid,note:'a'.repeat(501)}),/500/);
await api.submit(valid);
assert.equal(calls.at(-1).table,'cadre_submissions');
assert.equal(calls.at(-1).payload.status,'待审核');
assert.equal(calls.at(-1).payload.details.status,'迟到');
await assert.rejects(api.review(V,'reject',''),/驳回/);
await assert.rejects(api.review(V,'delete','a'),/审核动作/);
await api.review(V,'approve','核实');
assert.equal(calls.at(-1).name,'v7_review_attendance');
assert.equal(calls.at(-1).args.p_action,'approve');
await api.roster(U);
assert.equal(calls.at(-1).name,'v7_cadre_roster');
assert.equal(calls.filter(x=>x.table).length,1);
console.log('Alpha9 adapter assertions passed (12)');
