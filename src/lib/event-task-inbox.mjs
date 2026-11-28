/** Server-backed event inbox: all rows are filtered by Supabase RLS.
 * Counts are exact database counts; small item previews are NOT complete lists.
 * This is an in-app task reminder, NOT an unread-message or push system.
 */
export function inboxDefinitions(owned,accountId){
 if(typeof accountId!=='string'||!accountId)throw Error('需要当前登录账号');
 return owned
  ? [
    {id:'owner_unassigned',label:'待指派负责人',status:'待分派',filter:null,action:'assign'},
    {id:'owner_review',label:'待班主任复核',status:'待复核',filter:null,action:'close'},
    {id:'owner_self',label:'我负责处理',status:'处理中',filter:{column:'assigned_to',id:accountId},action:'reply'}
   ]
  : [
    {id:'cadre_assigned',label:'分配给我的任务',status:'处理中',filter:{column:'assigned_to',id:accountId},action:'reply'},
    {id:'cadre_created',label:'我发起待指派',status:'待分派',filter:{column:'created_by',id:accountId},action:'view'}
   ];
}
export function assertInboxQueryResult(response,group,classId){
 if(response?.error)throw Error('待办提醒读取失败，不能把失败的查询当作0条');
 if(!Array.isArray(response?.data)||!Number.isSafeInteger(response.count)||response.count<0)
  throw Error('待办数量不完整，不能报告准确待办数');
 if(response.data.length>response.count)throw Error('待办数量与返回行数矛盾');
 for(const r of response.data){
  if(r.class_id!==classId||r.status!==group.status||
    (group.filter&&r[group.filter.column]!==group.filter.id))
   throw Error('待办结果跨越了班级、状态或本人责任范围');
 }
 return {id:group.id,label:group.label,status:group.status,action:group.action,
  count:response.count,items:response.data.map(x=>({
   id:x.id,studentId:x.student_id,kind:x.kind,title:x.title,
   status:x.status,updatedAt:x.updated_at
  }))};
}
export function buildInboxSummary(groups){
 if(!Array.isArray(groups)||groups.some(g=>!Number.isSafeInteger(g.count)))throw Error('待办数据不完整');
 return {groups,total:groups.reduce((n,g)=>n+g.count,0),source:'数据库授权查询',
  message:'站内待办提示，需要手动刷新；不是已读回执或微信、短信推送'};
}
