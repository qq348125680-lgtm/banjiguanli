import {useEffect,useMemo,useRef,useState} from 'react';
import {withReadDeadline} from '../lib/read-deadline.mjs';
import {CLASS_RECORD_KINDS} from '../lib/class-records.mjs';

type EventItem={
 key:string;sourceId:string;kind:string;studentId:string;studentName:string;
 date:string;summary:string;stateLabel:string;needsFollowUp:boolean;nextAction:string;source:string;
};
type Feed={events:EventItem[];failedKinds:string[];limited:boolean};
type Props={load:()=>Promise<Feed>;owned:boolean;onStudent:(id:string)=>void;onRecord:(kind:string)=>void;onCreateCase?:(studentId:string,kind:string,summary:string)=>void;onRelations?:(id:string)=>void;focusStudentId?:string;onClearFocus?:()=>void};
export function EventCenterPanel({load,owned,onStudent,onRecord,onCreateCase,onRelations,focusStudentId='',onClearFocus}:Props){
 const [feed,setFeed]=useState<Feed|null>(null);
 const [kind,setKind]=useState('全部'),[scope,setScope]=useState('全部'),[search,setSearch]=useState('');
 const [page,setPage]=useState(1),[revision,setRevision]=useState(0);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const seq=useRef(0);
 useEffect(()=>{
  const current=++seq.current;setFeed(null);setBusy(true);setError('');
  withReadDeadline(load).then(value=>{if(seq.current===current)setFeed(value)})
   .catch(()=>{if(seq.current===current)setError('事件读取失败。请检查班级授权或网络，然后重新读取。')})
   .finally(()=>{if(seq.current===current)setBusy(false)});
  return ()=>{seq.current++};
 },[load,revision]);
 useEffect(()=>setPage(1),[kind,scope,search]);
 const visible=useMemo(()=>{
  const needle=search.trim().toLowerCase();
  return (feed?.events??[]).filter(e=>
   (!focusStudentId||e.studentId===focusStudentId)&&
   (kind==='全部'||kind===e.kind)&&
   (scope==='全部'||(scope==='待跟进'?e.needsFollowUp:!e.needsFollowUp))&&
   (!needle||e.studentName.toLowerCase().includes(needle)||e.summary.toLowerCase().includes(needle))
  );
 },[feed,kind,scope,search,focusStudentId]);
 const pages=Math.max(1,Math.ceil(visible.length/10));
 const pageItems=visible.slice((page-1)*10,page*10);
 const pending=(feed?.events??[]).filter(e=>e.needsFollowUp).length;
 return <section className="panel event-center" aria-label="班级事件中心">
  <div className="panel-head"><div><h2>班级事件中心</h2><p>{owned?'班主任授权范围 · 六类现有记录汇总':'班干部授权范围 · 仅我的提交记录'}</p></div><span className="count">{busy?'读取中':feed?visible.length+' 条':'—'}</span></div>
  <div className="event-overview">
   <div><strong>{feed?feed.events.length:'—'}</strong><span>本次可见事件</span></div>
   <div><strong>{feed?pending:'—'}</strong><span>状态提示待跟进</span></div>
   <div><strong>{feed?.failedKinds.length?'不完整':'只读'}</strong><span>事件数据状态</span></div>
  </div>
  {focusStudentId&&<div className="event-linked-scope"><span>正在查看从用户关系跳转的指定学生事件</span>{onClearFocus&&<button type="button" className="record-refresh" onClick={onClearFocus}>查看全部学生</button>}</div>}
  <div className="event-filters">
   <label>筛选事件 <select value={kind} onChange={e=>setKind(e.target.value)}><option value="全部">全部事件</option>{CLASS_RECORD_KINDS.map(k=><option value={k} key={k}>{k}</option>)}</select></label>
   <label>当前状态 <select value={scope} onChange={e=>setScope(e.target.value)}><option>全部</option><option>待跟进</option><option>其他</option></select></label>
   <label>搜索学生或摘要 <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索姓名、学号以外的事件摘要" aria-label="搜索事件"/></label>
   <button type="button" className="record-refresh" disabled={busy} onClick={()=>setRevision(v=>v+1)}>刷新</button>
  </div>
  {feed?.failedKinds.length? <p role="status" className="notice error">部分事件类别未读取成功：{feed.failedKinds.join('、')}。当前仅展示已读取的记录，不能当作全班完整统计。</p>:null}
  {error&&<p role="alert" className="notice error">{error}</p>}
  <div className="event-list">
   {pageItems.map(item=><article className="event-row" key={item.key}>
    <div className="event-row-top"><span className="event-type">{item.kind}</span><strong>{item.studentName}</strong><time>{item.date}</time><span className={item.needsFollowUp?'event-state is-pending':'event-state'}>{item.stateLabel}</span></div>
    <p>{item.summary}</p>
    <div className="event-row-next"><span>建议下一步：{item.nextAction}</span>
     <div>{owned&&<button type="button" className="record-refresh" onClick={()=>onStudent(item.studentId)}>学生档案</button>}
      {owned&&onCreateCase&&<button type="button" className="record-refresh" onClick={()=>onCreateCase(item.studentId,item.kind,item.summary)}>发起跟进工单</button>}
      {owned&&onRelations&&<button type="button" className="record-refresh" onClick={()=>onRelations(item.studentId)}>关联用户</button>}
      {owned&&<button type="button" className="record-refresh" onClick={()=>onRecord(item.kind)}>查看原始记录</button>}
     </div>
    </div>
   </article>)}
  </div>
  {!busy&&!error&&feed&&visible.length===0&&<div className="preview-empty">当前筛选下没有可见事件。请调整筛选条件，或返回业务记录核对。</div>}
  {visible.length>10&&<nav className="record-pagination" aria-label="事件列表分页"><button type="button" disabled={page<=1} onClick={()=>setPage(v=>Math.max(1,v-1))}>上一页</button><span>第 {page} / {pages} 页</span><button type="button" disabled={page>=pages} onClick={()=>setPage(v=>v+1)}>下一页</button></nav>}
  <p className="muted">这里是既有业务记录的事件视图（每类最多展示最近 20 条），不代表完整历史或独立创建的事件。待跟进是状态提示，不会自动判定结案；家校沟通内容不在此展示。</p>
 </section>;
}
