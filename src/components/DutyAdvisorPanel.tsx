import {useEffect,useState} from 'react';
import type {StudentItem} from '../lib/bridge';
import {dutyWorkload,proposeDutySubstitute} from '../lib/duty-planner.mjs';

export function DutyAdvisorPanel({records,students}:{records:Record<string,unknown>[];students:StudentItem[]}){
 const duties=records.map(r=>({student_id:String(r.student_id??''),duty_date:String(r.duty_date??''),area:String(r.area??''),status:String(r.status??'')}));
 const [absentId,setAbsentId]=useState(''),[date,setDate]=useState(''),[unavailableIds,setUnavailableIds]=useState<string[]>([]);
 const [result,setResult]=useState<ReturnType<typeof proposeDutySubstitute>|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{setResult(null);setError('')},[records,students,date,absentId,unavailableIds]);
 const named=new Map(students.map(s=>[s.id,s.name]));
 const dates=[...new Set(duties.map(row=>row.duty_date).filter(Boolean))].sort().reverse();
 const assigned=duties.filter(row=>row.duty_date===date);
 const absentOptions=[...new Set(assigned.map(row=>row.student_id))].filter(id=>named.has(id));
 const workload=dutyWorkload(students,duties);
 function propose(){
  setError('');setResult(null);
  try{setResult(proposeDutySubstitute({people:students,records:duties,dutyDate:date,absentStudentId:absentId,excludedIds:unavailableIds}))}
  catch(e){setError(e instanceof Error?e.message:'无法生成替补建议')}
 }
 return <div className="duty-advisor" aria-label="值日临时替补建议">
  <h3>临时替补与公平参考</h3>
  <p className="muted">根据当前已加载的值日记录，按任务负担估算替补顺序。拖地按 3 分、扫地按 2 分、其他任务按 1 分；这些只是建议权重，不是学生纪律积分。</p>
  <div className="duty-form">
   <label>值日日期<select aria-label="选择值日日期" value={date} onChange={e=>{setDate(e.target.value);setAbsentId('');setUnavailableIds([])}}><option value="">选择当前页已有日期</option>{dates.map(v=><option key={v} value={v}>{v}</option>)}</select></label>
   <label>需要替补的学生<select aria-label="选择缺席值日学生" value={absentId} onChange={e=>setAbsentId(e.target.value)} disabled={!date}><option value="">请选择</option>{absentOptions.map(id=><option value={id} key={id}>{named.get(id)}</option>)}</select></label>
   <button className="record-refresh" type="button" disabled={!absentId} onClick={propose}>生成替补建议</button>
  </div>
  {date&&<div className="duty-exclusions"><span className="muted">其他不可安排人员（可多选）：</span><div className="duty-chip-list">{students.filter(s=>s.id!==absentId).map(s=><label key={s.id}><input type="checkbox" checked={unavailableIds.includes(s.id)} onChange={e=>setUnavailableIds(v=>e.target.checked?[...v,s.id]:v.filter(id=>id!==s.id))}/>{s.name}</label>)}</div></div>}
  {error&&<p className="notice error" role="alert">{error}</p>}
  {result&&<div role="status" className="duty-result">{result.candidate?<><strong>建议：{result.candidate.name} 替补 {named.get(absentId)??'原值日学生'}</strong><p>任务：{result.original.area??'未注明区域'} · 样本工作量 {result.candidate.weight} 分 / {result.candidate.count} 次</p></>:<strong>暂无可推荐的替补</strong>}<p>{result.reason}</p></div>}
  <details className="duty-ranking"><summary>查看当前页工作量参考（{workload.length} 人）</summary><div>{workload.map(item=><p key={item.id}><span>{item.name}</span><span>{item.count} 次 · 参考负担 {item.weight} 分</span></p>)}</div></details>
  <p className="muted">当前页可能并非全部排班，且没有实时请假核对；生成建议不会修改任何值日安排。正式替换需由班主任在原系统确认。</p>
 </div>;
}
