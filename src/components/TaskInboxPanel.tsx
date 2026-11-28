import {useEffect,useRef,useState} from 'react';
import {withReadDeadline} from '../lib/read-deadline.mjs';
import type {StudentItem} from '../lib/bridge';

type Task={id:string;studentId:string;kind:string;title:string;status:string;updatedAt:string};
type Group={id:string;label:string;status:string;action:string;count:number;items:Task[]};
type Inbox={groups:Group[];total:number;source:string;message:string;owned:boolean};
type Props={load:()=>Promise<Inbox>;roster:StudentItem[];onOpen:(caseId:string)=>void};
export function TaskInboxPanel({load,roster,onOpen}:Props){
 const [value,setValue]=useState<Inbox|null>(null),[busy,setBusy]=useState(true);
 const [error,setError]=useState(''),[revision,setRevision]=useState(0);
 const seq=useRef(0);
 useEffect(()=>{
  const current=++seq.current;
  setBusy(true);setValue(null);setError('');
  withReadDeadline(load).then(data=>{if(current===seq.current)setValue(data)})
   .catch(()=>{if(current===seq.current)setError('暂时无法读取事件待办；请检查登录状态、授权或事件工单迁移。')})
   .finally(()=>{if(current===seq.current)setBusy(false)});
  return ()=>{seq.current++};
 },[load,revision]);
 const names=new Map(roster.map(s=>[s.id,s.name]));
 return <section className="panel task-inbox" aria-label="事件工单待办提醒">
  <div className="panel-head"><div><h2>我的事件待办</h2><p>{value?.owned?'班主任：待指派、待复核及本人任务':'班干部：分配给我的任务和我创建的待分派事件'}</p></div>
   <button type="button" className="record-refresh" disabled={busy} onClick={()=>setRevision(v=>v+1)}>刷新提醒</button></div>
  {busy&&<p role="status" className="muted">正在核对当前账号的待办…</p>}
  {error&&<p role="alert" className="notice error">{error} 当前不显示未经确认的待办数字。</p>}
  {value&&<>
   <div className="task-inbox-total"><strong>{value.total}</strong><span>项需要关注的工单</span><small>数据库精确计数 · 不是未读消息数</small></div>
   <div className="task-inbox-groups">{value.groups.map(group=><div className="task-inbox-group" key={group.id}>
    <div className="task-inbox-group-head"><strong>{group.label}</strong><span>{group.count} 项</span></div>
    {group.items.map(item=><button type="button" className="task-inbox-link" key={item.id} onClick={()=>onOpen(item.id)}>
     <div><strong>{item.kind} · {item.title}</strong><small>{names.get(item.studentId)??'授权名单之外的历史学生'} · {item.status} · {item.updatedAt?.slice(0,10)}</small></div>
     <span aria-hidden="true">查看工单 ›</span></button>)}
    {group.count===0&&<p className="muted">当前没有此类待办</p>}
    {group.count>group.items.length&&<p className="muted">仅展示最早的 {group.items.length} 项，其他待办可在事件工单中查看。</p>}
   </div>)}</div>
   <p className="muted">{value.message} 如有新指派或新反馈，请点击“刷新提醒”。</p>
  </>}
 </section>;
}
