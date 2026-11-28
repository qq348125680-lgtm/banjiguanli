/** Pure read-only weekly attendance digest derived from caller-provided visible records.
 * Does not add absentee entries or change persisted attendance.
 */
export function weekStartMonday(dateString){
 const d=new Date(String(dateString)+'T00:00:00Z');
 if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==dateString)throw Error('日期不合法');
 const dow=d.getUTCDay();
 d.setUTCDate(d.getUTCDate()-((dow+6)%7));
 return d.toISOString().slice(0,10);
}
export function attendanceDigest(records,roster,weekStart){
 if(weekStartMonday(weekStart)!==weekStart)throw Error('请选择周一作为一周开始日期');
 const end=new Date(weekStart+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+6);
 const weekEnd=end.toISOString().slice(0,10);
 const counts=new Map((roster??[]).filter(x=>x?.id).map(x=>[x.id,{id:x.id,name:x.name??'',student_no:x.student_no??'',late:0,absent:0,leave:0,present:0,other:0,total:0}]));
 let rows=0;
 for(const r of records??[]){
  if(!r||r.on_date<weekStart||r.on_date>weekEnd)continue;
  const c=counts.get(r.student_id);if(!c)continue;rows++;c.total++;
  if(r.status==='迟到')c.late++;
  else if(r.status==='缺勤'||r.status==='旷课')c.absent++;
  else if(r.status==='事假'||r.status==='病假'||r.status==='请假')c.leave++;
  else if(r.status==='出勤')c.present++;
  else c.other++;
 }
 const students=[...counts.values()].filter(x=>x.total>0).map(x=>({...x,lateEquivalent:Math.floor(x.late/2)})).sort((a,b)=>(b.absent+b.lateEquivalent)-(a.absent+a.lateEquivalent)||b.late-a.late||a.student_no.localeCompare(b.student_no,'zh-CN'));
 return {weekStart,weekEnd,visibleRows:rows,students,totalLate:students.reduce((n,x)=>n+x.late,0),totalAbsent:students.reduce((n,x)=>n+x.absent,0),lateEquivalent:students.reduce((n,x)=>n+x.lateEquivalent,0)};
}
