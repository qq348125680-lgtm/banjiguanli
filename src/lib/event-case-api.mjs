import {assertUuid} from './supabase-readonly-adapter.mjs';

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
 async function list(classId,{page=1,pageSize=10,status='全部'}={}){
  await user();assertUuid(classId);validPage(page,pageSize);
  if(status!=='全部'&&!CASE_STATES.includes(status))throw Error('事件状态筛选不合法');
  let q=client.from('v7_event_cases').select('id,class_id,student_id,kind,title,description,status,assigned_to,created_by,created_at,updated_at,closed_at',{count:'exact'}).eq('class_id',classId);
  if(status!=='全部')q=q.eq('status',status);
  const {data,error,count}=await q.order('updated_at',{ascending:false}).order('id',{ascending:false}).range((page-1)*pageSize,page*pageSize-1);
  if(error)throw error;return {items:data??[],count:count??null,page,pageSize};
 }
 async function history(classId,caseId){
  await user();assertUuid(classId);assertUuid(caseId);
  const {data,error}=await client.from('v7_event_case_history')
   .select('id,case_id,action,actor_id,from_status,to_status,note,created_at')
   .eq('class_id',classId).eq('case_id',caseId).order('created_at',{ascending:true}).limit(100);
  if(error)throw error;return data??[];
 }
 async function assignees(classId){
  const u=await user();assertUuid(classId);
  const {data:cls,error:ce}=await client.from('classes').select('id,owner_id').eq('id',classId).eq('owner_id',u.id).maybeSingle();
  if(ce)throw ce;if(!cls)throw Error('只有班主任可以查询当前班级可指派人员');
  const {data,error}=await client.from('class_delegates')
   .select('user_id,student_id,duty,enabled').eq('class_id',classId).eq('enabled',true).limit(100);
  if(error)throw error;
  return [{user_id:u.id,student_id:null,duty:'班主任（本人）',enabled:true},...(data??[])];
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
 return Object.freeze({list,history,assignees,create,transition});
}
