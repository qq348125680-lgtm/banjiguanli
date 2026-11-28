import {assertUuid} from './supabase-readonly-adapter.mjs';
import {inboxDefinitions,assertInboxQueryResult,buildInboxSummary} from './event-task-inbox.mjs';

export const CASE_KINDS=Object.freeze(['考勤','请假','违纪','积分','值日','家校沟通','其他']);
export const CASE_STATES=Object.freeze(['待分派','处理中','待复核','已结案']);
function validPage(page,size){if(!Number.isSafeInteger(page)||page<1||page>10000||![5,10,20].includes(size))throw Error('工单分页参数无效')}
export function validateCaseInput({classId,studentId,kind,title,description='',requestKey}){
 assertUuid(classId);assertUuid(studentId);assertUuid(requestKey);
 if(!CASE_KINDS.includes(kind))throw Error('不支持的事件类型');
 if(typeof title!=='string'||title.trim().length<2||title.trim().length>80)throw Error('事件标题须为2至80字');
 if(typeof description!=='string'||description.length>1000)throw Error('事件说明不能超过1000字');
 return {p_class_id:classId,p_student_id:studentId,p_kind:kind,p_title:title.trim(),p_description:description.trim(),p_request_key:requestKey};
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
 async function list(classId,{page=1,pageSize=10,status='全部',studentId='',assignedTo='',createdBy=''}={}){
  await user();assertUuid(classId);validPage(page,pageSize);
  if(status!=='全部'&&!CASE_STATES.includes(status))throw Error('事件状态筛选不合法');
  if(studentId)assertUuid(studentId);
  if(assignedTo)assertUuid(assignedTo);
  if(createdBy)assertUuid(createdBy);
  let q=client.from('v7_event_cases').select('id,class_id,student_id,kind,title,description,status,assigned_to,created_by,created_at,updated_at,closed_at',{count:'exact'}).eq('class_id',classId);
  if(status!=='全部')q=q.eq('status',status);
  if(studentId)q=q.eq('student_id',studentId);
  if(assignedTo)q=q.eq('assigned_to',assignedTo);
  if(createdBy)q=q.eq('created_by',createdBy);
  const {data,error,count}=await q.order('updated_at',{ascending:false}).order('id',{ascending:false}).range((page-1)*pageSize,page*pageSize-1);
  if(error)throw error;return {items:data??[],count:count??null,page,pageSize};
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
 async function history(classId,caseId){
  await user();assertUuid(classId);assertUuid(caseId);
  const {data,error}=await client.from('v7_event_case_history')
   .select('id,case_id,action,actor_id,from_status,to_status,note,created_at')
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
  const {data,error}=await client.rpc('v7_create_event_case',validateCaseInput(input));
  if(error)throw error;if(typeof data!=='string')throw Error('创建工单未返回有效编号');
  assertUuid(data);return data;
 }
 async function transition(caseId,action,assignee,note){
  await user();
  const {data,error}=await client.rpc('v7_transition_event_case',validateCaseTransition(caseId,action,assignee,note));
  if(error)throw error;if(!data||data.id!==caseId||!CASE_STATES.includes(data.status))throw Error('工单变更结果未能核实');
  return data;
 }
 return Object.freeze({list,taskInbox,history,assignees,findByRequestKey,create,transition});
}
