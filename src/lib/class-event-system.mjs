import {CLASS_RECORD_KINDS} from './class-records.mjs';

export const EVENT_FLOW_STAGES=Object.freeze(['发现','分派','跟进','核对','完成']);
const isPending=status=>typeof status==='string'&&(/待|未处理|进行中|处理中/.test(status));
const safeText=(value,max=70)=>typeof value==='string'?value.trim().slice(0,max):'';
const kindSuggestion=Object.freeze({
 '考勤':'核对异常考勤与请假，必要时联系家长',
 '请假':'核对审批、返校日期及补课安排',
 '违纪':'核实事实、谈话教育并按校规跟进',
 '积分':'核对积分规则和关联事件',
 '值日':'核对责任区域，缺席时安排替补',
 '家校沟通':'按沟通约定跟进，相关详情仅在原记录查看'
});
const KINDS=new Set(CLASS_RECORD_KINDS);
const pickDate=(kind,row)=>({'考勤':row.on_date,'请假':row.start_on,'违纪':row.happened_on,'积分':row.happened_on,'值日':row.duty_date,'家校沟通':row.contacted_on})[kind];
const brief=(kind,row)=>{
 switch(kind){
  case '考勤':return safeText(row.status)||'已记录考勤';
  case '请假':return [safeText(row.category),safeText(row.status)].filter(Boolean).join(' · ')||'请假记录';
  case '违纪':return [safeText(row.category),Number.isFinite(row.points)?'积分影响 '+row.points:''].filter(Boolean).join(' · ')||'违纪记录';
  case '积分':return [safeText(row.rule_code),safeText(row.status)].filter(Boolean).join(' · ')||'积分记录';
  case '值日':return [safeText(row.area),safeText(row.status)].filter(Boolean).join(' · ')||'值日记录';
  case '家校沟通':return '已登记一次家校沟通（详情不在事件流展示）';
  default:return '业务记录';
 }
};
/** Read-model projection; never constructs new database facts, mutations or
 * sensitive family summaries. Each item retains original kind/id for drilldown.
 */
export function buildClassEventFeed(streams,students){
 const names=new Map((students??[]).filter(s=>s?.id).map(s=>[s.id,s.name]));
 const events=[],failedKinds=[];
 for(const stream of streams??[]){
  const kind=stream?.kind;
  if(!KINDS.has(kind))continue;
  if(stream.error){failedKinds.push(kind);continue}
  for(const row of (Array.isArray(stream.records)?stream.records:[]).slice(0,20)){
   if(!row?.id||!names.has(row.student_id))continue;
   const date=pickDate(kind,row);
   if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}/.test(date))continue;
   const status=safeText(row.status);
   events.push({
    key:kind+':'+row.id,
    sourceId:String(row.id),
    kind,studentId:row.student_id,studentName:names.get(row.student_id),
    date:date.slice(0,10),
    summary:brief(kind,row),
    stateLabel:status||'未设置处理状态',
    needsFollowUp:isPending(status),
    nextAction:kindSuggestion[kind],
    source:'正式班务记录'
   });
  }
 }
 events.sort((a,b)=>b.date.localeCompare(a.date)||a.kind.localeCompare(b.kind)||a.key.localeCompare(b.key));
 return {events,failedKinds,limited:true};
}
export function buildDelegateEventFeed(submissions,roster){
 const names=new Map((roster??[]).filter(s=>s?.id).map(s=>[s.id,s.name]));
 const events=[];
 for(const row of (submissions??[]).slice(0,20)){
  if(!row?.id||!names.has(row.student_id)||!KINDS.has(row.entry_type))continue;
  const date=typeof row.occurred_on==='string'?row.occurred_on.slice(0,10):'';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;
  const status=safeText(row.status);
  const itemStatus=typeof row.details?.status==='string'?safeText(row.details.status):'';
  events.push({
   key:'申请:'+row.id,sourceId:String(row.id),kind:row.entry_type,
   studentId:row.student_id,studentName:names.get(row.student_id),date,
   summary:[row.entry_type,itemStatus].filter(Boolean).join(' · '),
   stateLabel:status||'状态未知',needsFollowUp:isPending(status),
   nextAction:status==='待审核'?'等待班主任审核，可在“我的提交”查看结果':kindSuggestion[row.entry_type],
   source:'本人提交的申请'
  });
 }
 events.sort((a,b)=>b.date.localeCompare(a.date)||a.key.localeCompare(b.key));
 return {events,failedKinds:[],limited:true};
}
export function advanceDemoStage(current){
 const n=EVENT_FLOW_STAGES.indexOf(current);
 return n<0?EVENT_FLOW_STAGES[0]:EVENT_FLOW_STAGES[Math.min(n+1,EVENT_FLOW_STAGES.length-1)];
}
