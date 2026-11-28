import {useEffect,useRef,useState} from 'react';
import {withReadDeadline} from '../lib/read-deadline.mjs';

type Pending={id:string;caseId:string;targetUserId:string;note:string;createdAt:string};
type Result={count:number;items:Pending[];owned:boolean};
type Props={load:()=>Promise<Result>;onOpen:(caseId:string)=>void};
export function CaseNudgeInboxPanel({load,onOpen}:Props){
 const [data,setData]=useState<Result|null>(null),[busy,setBusy]=useState(true);
 const [error,setError]=useState(''),[revision,setRevision]=useState(0);
 const request=useRef(0);
 useEffect(()=>{
  const seq=++request.current;setBusy(true);setData(null);setError('');
  withReadDeadline(load).then(result=>{if(seq===request.current)setData(result)})
   .catch(()=>{if(seq===request.current)setError('催办状态读取失败，不能把未确认记录算作0条。')})
   .finally(()=>{if(seq===request.current)setBusy(false)});
  return ()=>{request.current++};
 },[load,revision]);
 return <section className="panel case-nudge-inbox" aria-label="工单催办待办">
  <div className="panel-head"><div><h2>工单催办</h2><p>班主任发送站内催办，负责人提交反馈后自动解除待回应状态</p></div>
   <button type="button" className="record-refresh" disabled={busy} onClick={()=>setRevision(v=>v+1)}>刷新催办</button></div>
  {busy&&<p className="muted" role="status">正在读取尚未回复的催办记录…</p>}
  {error&&<p className="notice error" role="alert">{error}</p>}
  {data&&<>
   <div className="case-nudge-count"><strong>{data.count}</strong><span>{data.owned?'条已催办、待干部反馈':'条分配给我、尚待反馈'}的工单</span></div>
   <div className="case-nudge-list">{data.items.map(item=><button type="button" className="task-inbox-link" key={item.id} onClick={()=>onOpen(item.caseId)}>
    <div><strong>{item.note}</strong><small>催办日期 {item.createdAt?.slice(0,10)} · 待处理反馈</small></div>
    <span>{data.owned?'查看跟进':'立即反馈'} ›</span></button>)}</div>
   {data.count===0&&<p className="muted">当前没有需要回应的催办任务。</p>}
   {data.count>data.items.length&&<p className="muted">仅展示最新的 {data.items.length} 条，其余可在事件工单中查看处理流水。</p>}
   <p className="muted">此提醒仅在工作台内展示，非短信、微信消息或已读回执；已反馈或转派的催办会自动从当前列表移除，历史仍保留。</p>
  </>}
 </section>;
}
