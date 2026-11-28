import {assertUuid} from './supabase-readonly-adapter.mjs';

export const GUARDIAN_RELATIONS=Object.freeze(['父亲','母亲','监护人','其他亲属','其他']);
export const GUARDIAN_STATUSES=Object.freeze(['待核实','已核实','已失效']);
export function maskGuardianPhone(phone){
 if(typeof phone!=='string'||phone.length<7)return '••••';
 return phone.slice(0,3)+'••••'+phone.slice(-4);
}
export function validateGuardianInput({classId,studentId,name,relation,phone,requestKey}){
 assertUuid(classId);assertUuid(studentId);assertUuid(requestKey);
 if(typeof name!=='string'||name.trim().length<2||name.trim().length>80)throw Error('联系人姓名需要2至80个字');
 if(!GUARDIAN_RELATIONS.includes(relation))throw Error('联系人关系分类不合法');
 if(typeof phone!=='string'||phone.trim().length<7||phone.trim().length>25||!/^[0-9+() .-]+$/.test(phone.trim()))throw Error('联系方式格式不符合要求');
 return {p_class_id:classId,p_student_id:studentId,p_name:name.trim(),p_relation:relation,p_phone:phone.trim(),p_request_key:requestKey};
}
export function validateGuardianStatus(id,action,note){
 assertUuid(id);
 if(!['verify','deactivate','reactivate'].includes(action))throw Error('联系人状态操作不支持');
 if(typeof note!=='string'||note.trim().length<2||note.trim().length>300)throw Error('需填写2至300字的核实依据或停用原因');
 return {p_id:id,p_action:action,p_note:note.trim()};
}
export function createGuardianLinksApi(client){
 if(!client?.from||!client?.rpc||!client?.auth?.getUser)throw Error('需要已连接的 Supabase 客户端');
 async function user(){const {data,error}=await client.auth.getUser();if(error)throw error;if(!data?.user?.id)throw Error('登录状态已失效');return data.user;}
 async function list(classId,{page=1,pageSize=10,studentId='',status='全部'}={}){
  await user();assertUuid(classId);
  if(!Number.isSafeInteger(page)||page<1||page>10000||![5,10,20].includes(pageSize))throw Error('分页参数无效');
  if(studentId)assertUuid(studentId);
  if(status!=='全部'&&!GUARDIAN_STATUSES.includes(status))throw Error('联系人状态筛选无效');
  let q=client.from('v7_guardian_links')
   .select('id,class_id,student_id,contact_name,relation,contact_phone,verification_status,verified_at,created_at,updated_at',{count:'exact'})
   .eq('class_id',classId);
  if(studentId)q=q.eq('student_id',studentId);
  if(status!=='全部')q=q.eq('verification_status',status);
  const {data,error,count}=await q.order('updated_at',{ascending:false}).order('id',{ascending:false}).range((page-1)*pageSize,page*pageSize-1);
  if(error)throw error;
  return {items:data??[],count:count??null,page,pageSize};
 }
 async function history(classId,id){
  await user();assertUuid(classId);assertUuid(id);
  const {data,error}=await client.from('v7_guardian_link_history')
   .select('id,link_id,actor_id,action,from_status,to_status,note,created_at')
   .eq('class_id',classId).eq('link_id',id).order('created_at',{ascending:true}).limit(100);
  if(error)throw error;return data??[];
 }
 async function findByRequestKey(classId,key){
  const u=await user();assertUuid(classId);assertUuid(key);
  const {data,error}=await client.from('v7_guardian_links')
   .select('id,class_id,student_id,verification_status')
   .eq('class_id',classId).eq('request_key',key).eq('created_by',u.id).maybeSingle();
  if(error)throw error;return data??null;
 }
 async function create(input){
  await user();
  const {data,error}=await client.rpc('v7_create_guardian_link',validateGuardianInput(input));
  if(error)throw error;assertUuid(data);return data;
 }
 async function change(id,action,note){
  await user();
  const {data,error}=await client.rpc('v7_change_guardian_link',validateGuardianStatus(id,action,note));
  if(error)throw error;
  if(!data||data.id!==id||!GUARDIAN_STATUSES.includes(data.status))throw Error('联系人状态没有得到服务器确认');
  return data;
 }
 return Object.freeze({list,history,findByRequestKey,create,change});
}
