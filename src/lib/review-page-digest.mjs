/** Only page-scoped review hints. No new access, no automatic approvals. */
export function reviewPageDigest(items, now = new Date()){
 const list=Array.isArray(items)?items:[];
 const today=now instanceof Date?now:new Date(now);
 if(Number.isNaN(today.getTime()))throw Error('复核日期不合法');
 const pending=list.filter(i=>i?.status==='待审核');
 const counts={pending:pending.length,approved:list.filter(i=>i?.status==='已通过').length,rejected:list.filter(i=>i?.status==='已驳回').length,unknown:list.filter(i=>!['待审核','已通过','已驳回'].includes(i?.status)).length,total:list.length};
 const seen=new Map();
 const rows=pending.map(i=>{
  const created=new Date(i.created_at);
  const ageDays=Number.isNaN(created.getTime())?null:Math.max(0,Math.floor((today.getTime()-created.getTime())/86400000));
  const key=[i.student_id,i.entry_type,i.occurred_on].map(x=>String(x??'')).join('|');
  seen.set(key,(seen.get(key)??0)+1);
  const missingStatus=i.entry_type==='考勤'&&!String(i.details?.status??'').trim();
  return {id:i.id,student_id:i.student_id,entry_type:i.entry_type,occurred_on:i.occurred_on,ageDays,missingStatus,key};
 });
 const bySubmitter=new Map();
 for(const i of list){
  const key=typeof i?.submitted_by==='string'&&i.submitted_by.trim()?i.submitted_by:'操作人未知';
  const current=bySubmitter.get(key)??{actorId:key,visible:0,pending:0,approved:0,rejected:0};
  current.visible++;
  if(i.status==='待审核')current.pending++;
  else if(i.status==='已通过')current.approved++;
  else if(i.status==='已驳回')current.rejected++;
  bySubmitter.set(key,current);
 }
 return {counts,pending:rows.map(x=>({...x,duplicateOnPage:seen.get(x.key)>1})),oldestDays:rows.map(x=>x.ageDays).filter(x=>x!==null).reduce((m,v)=>Math.max(m,v),0),submitters:[...bySubmitter.values()].sort((a,b)=>b.pending-a.pending||b.visible-a.visible||a.actorId.localeCompare(b.actorId))};
}
