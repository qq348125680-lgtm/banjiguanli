import {assertUuid} from './supabase-readonly-adapter.mjs';
import {inboxDefinitions,assertInboxQueryResult,buildInboxSummary} from './event-task-inbox.mjs';
import {schoolToday,validateSchoolDate,dueReminderDefinitions,verifyDueResponse,verifyWorkloadRows} from './case-deadline-model.mjs';

export const CASE_KINDS=Object.freeze(['考勤','请假','违纪','积分','值日','家校沟通','其他']);
export const CASE_STATES=Object.freeze(['待分派','处理中','待复核','已结案']);
export function validateDeadlineMutation(caseId,dueOn,expectedDueOn,note){
 assertUuid(caseId);
 validateSchoolDate(dueOn,true);
 validateSchoolDate(expectedDueOn,true);
 if(typeof note!=='string'||note.trim().length<2||note.trim().length>500)
  throw Error('调整处理期限需要填写2至500字的原因');
 return {p_case_id:caseId,p_due_on:dueOn,p_expected_due_on:expectedDueOn,p_note:note.trim()};
}
function validPage(page,size){if(!Number.isSafeInteger(page)||page<1||page>10000||![5,10,20].includes(size))throw Error('工单分页参数无效')}
export function validateCaseInput({classId,studentId,kind,title,description='',requestKey,sourceRecordId=''}){
 assertUuid(classId);assertUuid(studentId);assertUuid(requestKey);
 if(!CASE_KINDS.includes(kind))throw Error('不支持的事件类型');
 if(typeof title!=='string'||title.trim().length<2||title.trim().length>80)throw Error('事件标题须为2至80字');
 if(typeof description!=='string'||description.length>1000)throw Error('事件说明不能超过1000字');
 if(sourceRecordId){assertUuid(sourceRecordId);if(kind==='其他')throw Error('其他类别不能自动关联已有业务记录')}
 return {p_class_id:classId,p_student_id:studentId,p_kind:kind,p_title:title.trim(),p_description:description.trim(),p_request_key:requestKey,
  ...(sourceRecordId?{p_source_record_id:sourceRecordId}:{})};
}
export function validateCaseTransition(id,action,assignee,note=''){
 assertUuid(id);
 if(!['assign','reply','close','reopen'].includes(action))throw Error('工单操作不支持');
 if(typeof note!=='string'||note.length>1000)throw Error('处理说明不能超过1000字');
 if(action==='assign')assertUuid(assignee);
 if(action!=='assign'&&!note.trim())throw Error('请填写处理说明与依据');
 return {p_case_id:id,p_action:action,p_assignee:action==='assign'?assignee:null,p_note:note.trim()};
}
/** Database is the source of truth: RLS and transactional RPCs authorize work. */
export function createEventCaseApi(client){
 if(!client?.from||!client?.rpc||!client?.auth?.getUser)throw Error('需要 Supabase 业务客户端');
 async function user(){const {data,error}=await client.auth.getUser();if(error)throw error;if(!data?.user?.id)throw Error('登录已失效');return data.user;}
 async function list(classId,{page=1,pageSize=10,status='全部',studentId='',caseId='',assignedTo='',createdBy=''}={}){
  await user();assertUuid(classId);validPage(page,pageSize);
  if(status!=='全部'&&!CASE_STATES.includes(status))throw Error('事件状态筛选不合法');
  if(studentId)assertUuid(studentId);
  if(caseId)assertUuid(caseId);
  if(assignedTo)assertUuid(assignedTo);
  if(createdBy)assertUuid(createdBy);
  let q=client.from('v7_event_cases').select('id,class_id,student_id,kind,title,description,status,assigned_to,created_by,due_on,created_at,updated_at,closed_at',{count:'exact'}).eq('class_id',classId);
  if(status!=='全部')q=q.eq('status',status);
  if(studentId)q=q.eq('student_id',studentId);
  if(caseId)q=q.eq('id',caseId);
  if(assignedTo)q=q.eq('assigned_to',assignedTo);
  if(createdBy)q=q.eq('created_by',createdBy);
  const {data,error,count}=await q.order('updated_at',{ascending:false}).order('id',{ascending:false}).range((page-1)*pageSize,page*pageSize-1);
  if(error)throw error;return {items:data??[],count:count??null,page,pageSize};
 }
 /** Actual per-student case status totals, computed server-side with exact
  * counts rather than relying on a limited first page.
  */
 async function studentSummary(classId,studentId){
  await user();assertUuid(classId);assertUuid(studentId);
  const pairs=await Promise.all(CASE_STATES.map(async status=>{
   const {count,error}=await client.from('v7_event_cases')
    .select('id',{count:'exact',head:true})
    .eq('class_id',classId).eq('student_id',studentId).eq('status',status);
   if(error||!Number.isSafeInteger(count)||count<0)
    throw Error('学生事件工单统计未读取完整，不能显示零值');
   return [status,count];
  }));
  const counts=Object.fromEntries(pairs);
  return {counts,total:CASE_STATES.reduce((sum,status)=>sum+counts[status],0)};
 }
 /** Due date indicators are manual-refresh, not push notifications.
  * Owner sees all class cases; cadres see only cases assigned to themselves.
  */
 async function dueDigest(classId){
  const u=await user();assertUuid(classId);
  const {data:cls,error:ce}=await client.from('classes').select('id')
   .eq('id',classId).eq('owner_id',u.id).maybeSingle();
  if(ce)throw ce;
  const owned=Boolean(cls);
  if(!owned){
   const {data:delegated,error:de}=await client.from('class_delegates')
    .select('id').eq('class_id',classId).eq('user_id',u.id).eq('enabled',true).maybeSingle();
   if(de)throw de;if(!delegated)throw Error('当前账号没有待办访问权限');
  }
  const today=schoolToday();
  const groups=await Promise.all(dueReminderDefinitions(today).map(async(group)=>{
   let q=client.from('v7_event_cases')
    .select('id,class_id,student_id,title,kind,status,assigned_to,due_on',{count:'exact'})
    .eq('class_id',classId).neq('status','已结案');
   if(!owned)q=q.eq('assigned_to',u.id);
   if(group.comparison==='lt')q=q.lt('due_on',group.until);
   else if(group.comparison==='eq')q=q.eq('due_on',group.until);
   else q=q.gt('due_on',group.from).lte('due_on',group.until);
   const response=await q.order('due_on',{ascending:true}).limit(5);
   return verifyDueResponse(response,group,classId,owned?null:u.id);
  }));
  return {today,owned,groups,total:groups.reduce((n,g)=>n+g.count,0)};
 }
 /** One owner-only RPC aggregates all state/category/assignee totals. */
 async function classOverview(classId){
  await user();assertUuid(classId);
  const {data,error}=await client.rpc('v7_class_case_overview',{p_class_id:classId});
  if(error)throw error;
  return verifyWorkloadRows(data,CASE_STATES,CASE_KINDS);
 }
 async function setDeadline(caseId,dueOn,expectedDueOn,note){
  await user();
  const params=validateDeadlineMutation(caseId,dueOn,expectedDueOn,note);
  const {data,error}=await client.rpc('v7_set_case_deadline',params);
  if(error)throw error;
  if(!data||data.id!==caseId||data.due_on!==dueOn||!CASE_STATES.includes(data.status))
   throw Error('处理期限变更没有得到服务器确认');
  return data;
 }
 /** Class owner and current enabled delegate get their own actionable task
  * totals. Every bucket is a separate RLS-scoped database query.
  */
 async function taskInbox(classId){
  const u=await user();assertUuid(classId);
  const {data:ownerRow,error:ownerError}=await client.from('classes')
   .select('id').eq('id',classId).eq('owner_id',u.id).maybeSingle();
  if(ownerError)throw ownerError;
  const owned=Boolean(ownerRow);
  if(!owned){
   const {data:delegateRow,error:delegateError}=await client.from('class_delegates')
    .select('id').eq('class_id',classId).eq('user_id',u.id).eq('enabled',true).maybeSingle();
   if(delegateError)throw delegateError;
   if(!delegateRow)throw Error('当前账号已无班级待办访问权限');
  }
  const plan=inboxDefinitions(owned,u.id);
  const groups=await Promise.all(plan.map(async(group)=>{
   let q=client.from('v7_event_cases')
    .select('id,class_id,student_id,kind,title,status,assigned_to,created_by,updated_at',{count:'exact'})
    .eq('class_id',classId).eq('status',group.status);
   if(group.filter)q=q.eq(group.filter.column,group.filter.id);
   const response=await q.order('updated_at',{ascending:true}).limit(5);
   return assertInboxQueryResult(response,group,classId);
  }));
  return {...buildInboxSummary(groups),owned};
 }
 /** Teacher-only original source lookups; the mapping table denies干部
  * access, including source IDs relating to family contact notes.
  */
 async function sourceLinks(classId,sources){
  await user();assertUuid(classId);
  if(!Array.isArray(sources)||sources.length>120)throw Error('原记录关联查询超出上限');
  const keys=[...new Set(sources.filter(x=>x?.sourceId).map(x=>x.sourceId))];
  for(const id of keys)assertUuid(id);
  if(!keys.length)return [];
  const {data,error}=await client.from('v7_event_case_sources')
   .select('case_id,class_id,student_id,source_kind,source_record_id')
   .eq('class_id',classId).in('source_record_id',keys).limit(120);
  if(error)throw error;
  if(!Array.isArray(data))throw Error('原始事件关联数据格式不正确');
  const expected=new Set(sources.map(x=>x.kind+':'+x.sourceId+':'+x.studentId));
  for(const row of data){
   if(row.class_id!==classId||!expected.has(row.source_kind+':'+row.source_record_id+':'+row.student_id))
    throw Error('检测到与当前事件范围不匹配的关联记录，已停止展示');
  }
  return data;
 }
 async function history(classId,caseId){
  await user();assertUuid(classId);assertUuid(caseId);
  const {data,error}=await client.from('v7_event_case_history')
   .select('id,case_id,action,actor_id,from_status,to_status,previous_assignee,next_assignee,previous_due_on,next_due_on,note,created_at')
   .eq('class_id',classId).eq('case_id',caseId).order('created_at',{ascending:true}).limit(100);
  if(error)throw error;return data??[];
 }
 async function assignees(classId){
  await user();assertUuid(classId);
  // Legacy class_delegates SELECT RLS may hide cadres from the class owner;
  // a dedicated owner-verified RPC returns only the minimum assignee fields.
  const {data,error}=await client.rpc('v7_event_case_assignees',{p_class_id:classId});
  if(error)throw error;
  if(!Array.isArray(data))throw Error('负责人列表格式不正确');
  return data.filter(x=>x?.enabled===true&&typeof x.user_id==='string');
 }
 async function findByRequestKey(classId,requestKey){
  const u=await user();assertUuid(classId);assertUuid(requestKey);
  const {data,error}=await client.from('v7_event_cases')
   .select('id,class_id,student_id,kind,title,description,status,created_by')
   .eq('class_id',classId).eq('request_key',requestKey).eq('created_by',u.id).maybeSingle();
  if(error)throw error;return data??null;
 }
 async function create(input){
  await user();
  const params=validateCaseInput(input);
  const hasSource=Boolean(params.p_source_record_id);
  // Linked creation is owner-verified and atomic with its source pointer.
  const {data,error}=await client.rpc(hasSource?'v7_create_linked_event_case':'v7_create_event_case',params);
  if(error)throw error;if(typeof data!=='string')throw Error('创建工单未返回有效编号');
  assertUuid(data);return data;
 }
 async function transition(caseId,action,assignee,note){
  await user();
  const {data,error}=await client.rpc('v7_transition_event_case',validateCaseTransition(caseId,action,assignee,note));
  if(error)throw error;if(!data||data.id!==caseId||!CASE_STATES.includes(data.status))throw Error('工单变更结果未能核实');
  return data;
 }
 return Object.freeze({list,studentSummary,taskInbox,dueDigest,classOverview,setDeadline,sourceLinks,history,assignees,findByRequestKey,create,transition});
}
