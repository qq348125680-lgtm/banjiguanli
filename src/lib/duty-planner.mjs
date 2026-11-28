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

/** Classroom routine: four sweepers, three moppers, one combined board/podium/windows/trash,
 * and one desk-straightening student. Suggestions are not stored.
 */
export const DUTY_TASKS=Object.freeze([
 ...Array.from({length:3},()=>Object.freeze({area:'拖地',points:3})),
 ...Array.from({length:4},()=>Object.freeze({area:'扫地',points:2})),
 Object.freeze({area:'擦黑板、整理讲台多媒体、门窗、倒垃圾',points:1}),
 Object.freeze({area:'排桌子',points:1})
]);
export function planDutyRotation({people,records,dutyDate,excludedIds=/** @type {string[]} */ ([]) }){
 const date=new Date(String(dutyDate??'')+'T00:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(dutyDate??''))||Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==dutyDate)throw Error('值日日期不合法');
 const booked=new Set((records??[]).filter(r=>r.duty_date===dutyDate).map(r=>r.student_id));
 const unavailable=new Set(excludedIds);
 const candidates=dutyWorkload(people,records).filter(p=>!booked.has(p.id)&&!unavailable.has(p.id));
 if(candidates.length<DUTY_TASKS.length)return {assignments:[],missing:DUTY_TASKS.length-candidates.length,available:candidates.length,reason:'可用学生不足九人，未生成不完整排班'};
 const choices=candidates.map(p=>({...p})),assignments=[];
 for(const task of DUTY_TASKS){
  choices.sort((a,b)=>a.weight-b.weight||a.count-b.count||String(a.student_no).localeCompare(String(b.student_no),'zh-CN')||a.id.localeCompare(b.id));
  const assigned=choices.shift();
  assignments.push({student_id:assigned.id,name:assigned.name,area:task.area,loadBefore:assigned.weight,taskWeight:task.points});
 }
 return {assignments,missing:0,available:candidates.length,reason:'仅根据当前已加载记录的权重预排；未确认全学期历史、实际请假及当天未加载的任务'};
}
