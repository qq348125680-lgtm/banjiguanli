import {assertUuid} from './supabase-readonly-adapter.mjs';

export function validateNudgeInput(caseId,note){
 assertUuid(caseId);
 if(typeof note!=='string'||note.trim().length<2||note.trim().length>500)
  throw Error('催办原因应为2至500字');
 return {p_case_id:caseId,p_note:note.trim()};
}
/** An RPC/list failure is not an empty inbox; every task remains class-scoped. */
export function verifyPendingNudges(response,classId,userId,owned){
 if(response?.error||!Array.isArray(response?.data)||!Number.isSafeInteger(response?.count)||response.count<0)
  throw Error('催办待办读取失败，不能显示为0条');
 if(response.data.length>response.count)throw Error('催办待办计数不一致');
 for(const n of response.data){
  if(n.class_id!==classId||n.resolved_at!==null||typeof n.case_id!=='string'
   ||(!owned&&n.target_user_id!==userId))
   throw Error('催办记录不属于当前授权班级或当前负责人');
 }
 return {
  count:response.count,
  items:response.data.map(n=>({id:n.id,caseId:n.case_id,
   targetUserId:n.target_user_id,note:n.note,createdAt:n.created_at}))
 };
}
