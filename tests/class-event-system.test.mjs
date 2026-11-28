import test from 'node:test';
import assert from 'node:assert/strict';
import {buildClassEventFeed,buildDelegateEventFeed,EVENT_FLOW_STAGES,advanceDemoStage} from '../src/lib/class-event-system.mjs';
const student={id:'s-1',name:'虚构学生甲',student_no:'001'};
test('six existing business categories form one sorted event feed without inventing a persistent case',()=>{
 const streams=[
  {kind:'考勤',records:[{id:'a1',student_id:'s-1',on_date:'2026-11-25',status:'迟到'}]},
  {kind:'违纪',records:[{id:'v1',student_id:'s-1',happened_on:'2026-11-26',category:'课堂纪律',points:-1}]},
  {kind:'值日',records:[{id:'d1',student_id:'s-1',duty_date:'2026-11-27',area:'后排',status:'待完成'}]}
 ];
 const result=buildClassEventFeed(streams,[student]);
 assert.deepEqual(result.events.map(e=>e.kind),['值日','违纪','考勤']);
 assert.equal(result.events[0].needsFollowUp,true);
 assert.equal(result.events[1].sourceId,'v1');
 assert.equal(result.events[2].studentName,'虚构学生甲');
 assert.equal(result.limited,true);
});
test('family event projection never copies contact summary, guardian identity or phone',()=>{
 const payload={id:'f1',student_id:'s-1',contacted_on:'2026-11-28',method:'电话',summary:'隐私谈话',followup:'家庭敏感情况',parent_phone:'SECRET-123'};
 const item=buildClassEventFeed([{kind:'家校沟通',records:[payload]}],[student]).events[0];
 assert.ok(item);
 assert.equal(JSON.stringify(item).includes('隐私谈话'),false);
 assert.equal(JSON.stringify(item).includes('家庭敏感情况'),false);
 assert.equal(JSON.stringify(item).includes('SECRET-123'),false);
 assert.equal(item.kind,'家校沟通');
 assert.match(item.summary,/不在事件流展示/);
});
test('unknown student or invalid record date cannot appear under stale scope',()=>{
 const feed=buildClassEventFeed([{kind:'请假',records:[
  {id:'leave-other',student_id:'s-2',start_on:'2026-11-28',status:'待审批'},
  {id:'leave-bad',student_id:'s-1',start_on:'invalid',status:'待审批'},
  {id:'leave-good',student_id:'s-1',start_on:'2026-11-28',status:'待审批'}
 ]}],[student]);
 assert.equal(feed.events.length,1);
 assert.equal(feed.events[0].needsFollowUp,true);
});
test('failed categories are not falsely counted as zero; unknown category is ignored',()=>{
 const feed=buildClassEventFeed([{kind:'积分',records:[],error:true},{kind:'unknown',records:[{id:'x'}]}],[student]);
 assert.deepEqual(feed.failedKinds,['积分']);
 assert.equal(feed.events.length,0);
});
test('delegate feed reads only provided own requests with no private notes',()=>{
 const requests=[{id:'r1',student_id:'s-1',entry_type:'考勤',occurred_on:'2026-11-28',status:'待审核',details:{status:'迟到',note:'不要外显'}}];
 const result=buildDelegateEventFeed(requests,[student]);
 assert.equal(result.events.length,1);
 assert.equal(result.events[0].needsFollowUp,true);
 assert.equal(JSON.stringify(result).includes('不要外显'),false);
 assert.match(result.events[0].nextAction,/班主任审核/);
});
test('local event flow moves one stage per click and never past completion',()=>{
 let stage=EVENT_FLOW_STAGES[0];
 for(let i=0;i<EVENT_FLOW_STAGES.length+3;i++)stage=advanceDemoStage(stage);
 assert.equal(stage,'完成');
 assert.equal(advanceDemoStage('invalid'),'发现');
});
