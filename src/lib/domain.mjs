export const attendanceStatuses=Object.freeze(['出勤','迟到','缺勤','事假','病假']);
export function displayError(error){if(!error)return '未知错误';const code=String(error.code||'');if(code==='42501'||code==='PGRST301')return '当前账号没有权限，请检查授权状态或重新登录';if(code==='23505')return '此记录已经处理，或当天存在冲突考勤，请刷新后核对';if(code==='23514')return '学生不属于当前班级或已归档';if(code==='PGRST202'||code==='42883')return '数据库尚未安装 V7 审核接口，请继续使用旧版';return typeof error.message==='string'?error.message:'操作未完成，请稍后重试';}
export function sanitizeList(items){return (items||[]).map(s=>({id:String(s.student_id??s.id),student_no:String(s.student_no??''),name:String(s.student_name??s.name??'')}));}
export function statusTone(status){if(status==='已通过')return 'good';if(status==='已驳回')return 'bad';return 'pending';}
export function dateToday(){const now=new Date();const y=now.getFullYear();const m=String(now.getMonth()+1).padStart(2,'0');const d=String(now.getDate()).padStart(2,'0');return `${y}-${m}-${d}`;}
export function isReady(config){return Boolean(config.url&&config.key);}

// Only count true class-wide pending totals returned by an exact-count query.
export function pendingLabel(pendingCount){return Number.isInteger(pendingCount)&&pendingCount>=0?String(pendingCount):'—';}
export function validPageSize(n){return [5,10,20].includes(n);}
export function isValidDate(day){return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(`${day}T00:00:00Z`)) && new Date(`${day}T00:00:00Z`).toISOString().slice(0,10)===day;}
export function canSubmitAsDelegate({owned,delegated, classId, writesEnabled}){return Boolean(writesEnabled&&!owned&&delegated.some(d=>d.class_id===classId&&d.enabled!==false));}
export function auditSummary(row){return {id:row.id,action:row.action,table:row.table_name,rowId:row.row_id,at:row.changed_at,actor:row.actor_id};}

// Refuse to submit a student ID from a stale, unrelated class roster.
export function canSubmitToRoster({roster,studentId,classId,owned}){
 return Boolean(!owned && classId && studentId && Array.isArray(roster) && roster.some(s=>s.id===studentId && (!s.class_id || s.class_id===classId)));
}
export function canReviewSubmission(items,id,action){
 if(!['approve','reject'].includes(action)||!Array.isArray(items))return false;
 return items.some(item=>item.id===id&&item.status==='待审核'&&item.entry_type==='考勤');
}
