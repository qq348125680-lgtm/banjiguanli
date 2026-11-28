import {useEffect,useMemo,useRef,useState} from 'react';
import {withReadDeadline} from '../lib/read-deadline.mjs';
import {CASE_KINDS} from '../lib/event-case-api.mjs';
import type {StudentItem} from '../lib/bridge';

type ArchiveItem={id:string;class_id:string;student_id:string;kind:string;title:string;status:string;created_at:string;closed_at:string};
type ArchiveResult={items:ArchiveItem[];count:number;page:number;pageSize:number};
type Props={
 load:(filters:{page:number;pageSize:number;kind:string;from:string;to:string})=>Promise<ArchiveResult>;
 roster:StudentItem[];onOpen:(caseId:string)=>void;
};
const fmt=(value:string)=>{
 try{return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value))}
 catch{return '日期无效'}
};
export function ClosedCaseArchivePanel({load,roster,onOpen}:Props){
 const [kind,setKind]=useState('全部'),[from,setFrom]=useState(''),[to,setTo]=useState('');
 const [page,setPage]=useState(1),[data,setData]=useState<ArchiveResult|null>(null);
 const [busy,setBusy]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0),seq=useRef(0);
 useEffect(()=>{
  const current=++seq.current;setData(null);setError('');setBusy(true);
  withReadDeadline(()=>load({page,pageSize:10,kind,from,to}))
   .then(v=>{if(current===seq.current)setData(v)})
   .catch(()=>{if(current===seq.current)setError('结案记录读取失败，请检查日期、班主任权限或数据库模块是否完成迁移。')})
   .finally(()=>{if(current===seq.current)setBusy(false)});
  return ()=>{seq.current++};
 },[load,page,kind,from,to,revision]);
 const names=useMemo(()=>new Map(roster.map(s=>[s.id,s.name])),[roster]);
 const pages=data?Math.max(1,Math.ceil(data.count/10)):null;
 return <section className="panel closed-case-archive" aria-label="班级结案工单档案">
  <div className="panel-head"><div><h2>已结案事件档案</h2><p>直接查看原工单与处理流水 · 不复制、不隐藏原始历史</p></div>
   <button type="button" className="record-refresh" disabled={busy} onClick={()=>setRevision(v=>v+1)}>刷新档案</button></div>
  <div className="archive-filter-row">
   <label>事件类别 <select value={kind} onChange={e=>{setKind(e.target.value);setPage(1)}}><option>全部</option>{CASE_KINDS.map(x=><option key={x}>{x}</option>)}</select></label>
   <label>结案开始日期 <input type="date" value={from} max={to||undefined} onChange={e=>{setFrom(e.target.value);setPage(1)}}/></label>
   <label>结案结束日期 <input type="date" value={to} min={from||undefined} onChange={e=>{setTo(e.target.value);setPage(1)}}/></label>
   <button type="button" className="record-refresh" onClick={()=>{setKind('全部');setFrom('');setTo('');setPage(1)}}>清除筛选</button>
  </div>
  <div className="case-archive-shortcuts">
   <button type="button" className="record-refresh" onClick={()=>{setKind('家校沟通');setPage(1)}}>只看家校沟通结案</button>
   {data&&<span className="muted">符合条件：{data.count} 条工单</span>}
  </div>
  {busy&&<p className="muted" role="status">正在按条件读取服务器结案记录…</p>}
  {error&&<p className="notice error" role="alert">{error}</p>}
  {data&&<div className="closed-case-list">
   {data.items.map(item=><article className="closed-case-item" key={item.id}>
    <div className="closed-case-item-head"><span className="event-type">{item.kind}</span><strong>{item.title}</strong><span className="event-state">已结案</span></div>
    <p className="muted">关联学生：{names.get(item.student_id)??'当前花名册外历史学生'} · 结案：{fmt(item.closed_at)}</p>
    <button type="button" className="button secondary" onClick={()=>onOpen(item.id)}>查看原工单与完整处理流水</button>
   </article>)}
   {data.items.length===0&&<div className="preview-empty">当前筛选条件下没有已结案工单。本页不会把读取失败显示成“没有记录”。</div>}
  </div>}
  <div className="record-pagination" aria-label="已结案工单分页">
   <button type="button" disabled={busy||page<=1} onClick={()=>setPage(v=>v-1)}>上一页</button>
   <span>第 {page} / {pages??'—'} 页</span>
   <button type="button" disabled={busy||!data||page>=pages!} onClick={()=>setPage(v=>v+1)}>下一页</button>
  </div>
  <p className="muted">结案后如果被班主任退回，该工单会从当前“已结案”列表退出，重新进入处理流程；所有动作仍保留在原工单历史中。</p>
 </section>;
}
