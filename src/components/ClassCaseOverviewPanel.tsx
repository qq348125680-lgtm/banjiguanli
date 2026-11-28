import {useEffect,useRef,useState} from 'react';
import type {StudentItem} from '../lib/bridge';
import {CASE_KINDS,CASE_STATES} from '../lib/event-case-api.mjs';
import {withReadDeadline} from '../lib/read-deadline.mjs';

type Person={user_id:string;student_id:string|null;duty:string};
type Overview={status:Record<string,number>;kind:Record<string,number>;assignee:Record<string,number>;total:number;open:number;closed:number;people:Person[]};
type Props={load:()=>Promise<Overview>;roster:StudentItem[];onStatus:(status:string)=>void;onOpenCases:()=>void};
export function ClassCaseOverviewPanel({load,roster,onStatus,onOpenCases}:Props){
 const [value,setValue]=useState<Overview|null>(null),[busy,setBusy]=useState(true);
 const [problem,setProblem]=useState(''),[revision,setRevision]=useState(0);
 const seq=useRef(0);
 useEffect(()=>{
  const current=++seq.current;setValue(null);setProblem('');setBusy(true);
  withReadDeadline(load).then(data=>{if(current===seq.current)setValue(data)})
   .catch(()=>{if(current===seq.current)setProblem('班级工单统计暂时无法读取，未使用估计值或虚构数据。')})
   .finally(()=>{if(current===seq.current)setBusy(false)});
  return ()=>{seq.current++};
 },[load,revision]);
 const students=new Map(roster.map(s=>[s.id,s.name]));
 const labels=new Map((value?.people??[]).map(p=>[p.user_id,p.student_id?(students.get(p.student_id)??p.duty):p.duty]));
 const topPeople=value?Object.entries(value.assignee).sort((a,b)=>b[1]-a[1]):[];
 return <section className="panel class-case-overview" aria-label="班级事件工单统计">
  <div className="panel-head"><div><h2>事件办理统计</h2><p>全班真实工单 · 状态、类别、负责人工作量</p></div><button className="record-refresh" type="button" disabled={busy} onClick={()=>setRevision(v=>v+1)}>刷新统计</button></div>
  {busy&&<p role="status" className="muted">正在统计当前授权班级的工单…</p>}
  {problem&&<p role="alert" className="notice error">{problem}</p>}
  {value&&<>
   <div className="case-overview-summary"><div><b>{value.total}</b><span>工单总量</span></div><div><b>{value.open}</b><span>未结案</span></div><div><b>{value.closed}</b><span>已结案</span></div></div>
   <div className="case-overview-columns">
    <div><h3>按处理状态</h3><div className="case-overview-bars">{CASE_STATES.map(status=>{
     const count=value.status[status]??0;const max=Math.max(1,value.total);
     return <button className="case-overview-bar" type="button" key={status} onClick={()=>onStatus(status)}>
      <span>{status}</span><div className="case-overview-track"><i style={{width:Math.min(100,count/max*100)+'%'}}/></div><strong>{count}</strong></button>;
    })}</div></div>
    <div><h3>按事件类别</h3><div className="case-overview-types">{CASE_KINDS.map(kind=><div key={kind}><span>{kind}</span><strong>{value.kind[kind]??0}</strong></div>)}</div></div>
   </div>
   <div className="case-overview-workload"><h3>负责人在办工作量</h3>
    {topPeople.length?<div className="case-overview-people">{topPeople.map(([uid,n])=><div key={uid}><span>{labels.get(uid)??'原负责人账号 '+uid.slice(0,8)+'…'}</span><strong>{n} 件未结案</strong></div>)}</div>:<p className="muted">当前没有已指派且未结案的工单。</p>}
    <p className="muted">这里只统计目前分配给各负责人的未结案工单；待分派的不计入个人工作量，历史转派次数请查看工单流水。</p>
   </div>
   <button type="button" className="button secondary" onClick={onOpenCases}>查看全部事件工单</button>
  </>}
 </section>;
}
