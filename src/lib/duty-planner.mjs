/** Local duty substitution proposals; NEVER updates or inserts database rows.
 * Workload history is limited to caller-provided, currently loaded duty records.
 */
export const DUTY_WEIGHTS=Object.freeze([
  Object.freeze({match:'拖地',points:3}),
  Object.freeze({match:'扫地',points:2}),
  Object.freeze({match:'擦黑板',points:1}),
  Object.freeze({match:'讲台',points:1}),
  Object.freeze({match:'垃圾',points:1}),
  Object.freeze({match:'门窗',points:1}),
  Object.freeze({match:'排桌',points:1})
]);
export function dutyWeight(area){
 const text=String(area??'');
 return DUTY_WEIGHTS.find(x=>text.includes(x.match))?.points??1;
}
export function dutyWorkload(people,records){
 const map=new Map((Array.isArray(people)?people:[]).filter(s=>s?.id).map(s=>[s.id,{id:s.id,name:s.name??'',student_no:s.student_no??'',count:0,weight:0}]));
 for(const record of Array.isArray(records)?records:[]){
  const row=map.get(record?.student_id);
  if(row){row.count++;row.weight+=dutyWeight(record.area)}
 }
 return [...map.values()].sort((a,b)=>a.weight-b.weight||a.count-b.count||String(a.student_no).localeCompare(String(b.student_no),'zh-CN')||a.id.localeCompare(b.id));
}
export function proposeDutySubstitute({people,records,dutyDate,absentStudentId,excludedIds=/** @type {string[]} */ ([])}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(dutyDate??'')))throw Error('请先选择有效值日日期');
 if(!absentStudentId)throw Error('请选择需要替补的学生');
 const list=Array.isArray(records)?records:[];
 const original=list.find(x=>x.student_id===absentStudentId&&x.duty_date===dutyDate);
 if(!original)throw Error('当前已加载页找不到此学生当天的值日记录；请调整日期或页码');
 const occupied=new Set(list.filter(x=>x.duty_date===dutyDate).map(x=>x.student_id));
 const skipped=new Set([absentStudentId,...excludedIds]);
 const candidate=dutyWorkload(people,list).find(p=>!occupied.has(p.id)&&!skipped.has(p.id));
 if(!candidate)return {candidate:null,original,reason:'当前已加载记录无法找到合适替补，请到旧版核实完整排班和出勤'};
 return {candidate,original,reason:'仅依据当前已加载页的工作量作建议，尚未核验全部历史与实际出勤'};
}
