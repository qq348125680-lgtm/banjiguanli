import {useEffect,useRef,useState} from 'react';
import {withReadDeadline} from '../lib/read-deadline.mjs';
import type {StudentItem} from '../lib/bridge';

type DueTask={id:string;title:string;kind:string;studentId:string;dueOn:string;status:string};
type DueGroup={id:string;label:string;count:number;items:DueTask[]};
type Digest={today:string;owned:boolean;groups:DueGroup[];total:number};
type Props={load:()=>Promise<Digest>;roster:StudentItem[];onOpen:(caseId:string)=>void};
export function CaseDueReminderPanel({load,roster,onOpen}:Props){
 const [value,setValue]=useState<Digest|null>(null),[busy,setBusy]=useState(true);
 const [error,setError]=useState(''),[revision,setRevision]=useState(0);
 const seq=useRef(0);
 useEffect(()=>{
  const current=++seq.current;setBusy(true);setValue(null);setError('');
  withReadDeadline(load).then(data=>{if(current===seq.current)setValue(data)})
   .catch(()=>{if(current===seq.current)setError('到期提醒读取失败，不能判断当前没有逾期任务。')})
   .finally(()=>{if(current===seq.current)setBusy(false)});
  return ()=>{seq.current++};
 },[load,revision]);
 const names=new Map(roster.map(s=>[s.id,s.name]));
 return <section className="panel case-due-reminder" aria-label="工单处理期限提醒">
  <div className="panel-head"><div><h2>处理期限提醒</h2><p>{value?.owned?'当前班级全部未结案工单':'仅显示分配给我的未结案工单'} · 以学校日期为准</p></div>
   <button className="record-refresh" type="button" disabled={busy} onClick={()=>setRevision(v=>v+1)}>刷新期限</button></div>
  {busy&&<p className="muted" role="status">正在读取工单期限…</p>}
  {error&&<p className="notice error" role="alert">{error}</p>}
  {value&&<>
   <p className="muted">学校日期 {value.today} · 仅统计明确设置截止日期的工单。已结案和未设置截止日的工单不会列入逾期。</p>
   <div className="case-due-grid">{value.groups.map(g=><div className={'case-due-group '+(g.id==='overdue'?'case-due-overdue':'')} key={g.id}>
    <div className="case-due-group-title"><strong>{g.label}</strong><b>{g.count}</b></div>
    {g.items.map(t=><button type="button" key={t.id} className="task-inbox-link" onClick={()=>onOpen(t.id)}>
     <div><strong>{t.title}</strong><small>{names.get(t.studentId)??'当前名单外学生'} · {t.kind} · 截止 {t.dueOn}</small></div><span>处理 ›</span></button>)}
    {g.count===0&&<p className="muted">当前无此类到期工单</p>}
    {g.count>g.items.length&&<p className="muted">仅展示最早的 {g.items.length} 条，更多任务可在工单列表查看。</p>}
   </div>)}</div>
   <p className="muted">站内到期提醒不代表微信、短信或系统推送；打开工作台或点击刷新后才会读取最新数据。</p>
  </>}
 </section>;
}
