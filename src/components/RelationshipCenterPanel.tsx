import {useEffect,useMemo,useRef,useState} from 'react';
import {withReadDeadline} from '../lib/read-deadline.mjs';

type Student={id:string;name:string;student_no:string};
type Cadre={key:string;studentId:string|null;studentName:string|null;accountId:string;role:string;enabled:boolean};
type Snapshot={className:string;ownerId:string;memberCount:number;accountCount:number;students:Student[];cadres:Cadre[];guardianConnections:string};
type Props={load:()=>Promise<Snapshot>;onStudent:(id:string)=>void;onEvents:(id:string)=>void;focusStudentId?:string;onClearFocus?:()=>void};
export function RelationshipCenterPanel({load,onStudent,onEvents,focusStudentId='',onClearFocus}:Props){
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
 const [error,setError]=useState(''),[busy,setBusy]=useState(true),[refresh,setRefresh]=useState(0);
 const [tab,setTab]=useState<'cadres'|'students'>(focusStudentId?'students':'cadres'),[search,setSearch]=useState('');
 const seq=useRef(0);
 useEffect(()=>{
  const current=++seq.current;setSnapshot(null);setError('');setBusy(true);
  withReadDeadline(load).then(s=>{if(seq.current===current)setSnapshot(s)})
   .catch(()=>{if(seq.current===current)setError('班级用户关系读取失败，请重新验证授权或稍后重试。')})
   .finally(()=>{if(seq.current===current)setBusy(false)});
  return ()=>{seq.current++};
 },[load,refresh]);
 const matching=useMemo(()=>{
  const q=search.trim().toLowerCase();
  if(tab==='cadres')return (snapshot?.cadres??[]).filter(c=>
   (!focusStudentId||c.studentId===focusStudentId)&&(!q||(c.studentName??'').toLowerCase().includes(q)||c.role.toLowerCase().includes(q))
  );
  return (snapshot?.students??[]).filter(s=>(!focusStudentId||s.id===focusStudentId)&&(!q||s.name.toLowerCase().includes(q)||s.student_no.toLowerCase().includes(q)));
 },[snapshot,search,tab,focusStudentId]);
 return <section className="panel relation-center" aria-label="班级用户关系">
  <div className="panel-head"><div><h2>班级用户关系</h2><p>班级—班主任—班干部—学生，按当前真实账号授权建立关联</p></div><span className="count">只读关系视图</span></div>
  <div className="relation-summary">
   <div><strong>{snapshot?.className??'当前班级'}</strong><span>班主任（当前授权账号）</span></div>
   <div><strong>{snapshot?.memberCount??'—'}</strong><span>在读学生</span></div>
   <div><strong>{snapshot?.accountCount??'—'}</strong><span>已登记干部账号</span></div>
  </div>
  <div className="relation-topology" aria-label="班级角色关系示意">
   <span>班主任</span><span aria-hidden="true">→</span><span>班级</span><span aria-hidden="true">→</span><span>班干部 · 学生</span>
  </div>
  {focusStudentId&&<div className="event-linked-scope"><span>正在查看从事件中心定位的指定学生关系</span>{onClearFocus&&<button type="button" className="record-refresh" onClick={onClearFocus}>查看全部关系</button>}</div>}
  <div className="record-toolbar"><span className="muted">{busy?'正在读取关系…':error?'读取失败':'可核对账号是否绑定在读学生'}</span><button type="button" className="record-refresh" disabled={busy} onClick={()=>setRefresh(v=>v+1)}>刷新关系</button></div>
  {error&&<p role="alert" className="notice error">{error}</p>}
  <div className="record-tabs" role="group" aria-label="用户关系分类"><button type="button" className={tab==='cadres'?'active':''} aria-pressed={tab==='cadres'} onClick={()=>setTab('cadres')}>班干部身份</button><button type="button" className={tab==='students'?'active':''} aria-pressed={tab==='students'} onClick={()=>setTab('students')}>学生与班级</button></div>
  <label className="relation-search">筛选姓名或职责 <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索当前班级用户" aria-label="搜索用户关系"/></label>
  <div className="relation-rows">
   {tab==='cadres'&&matching.map((item)=><article className="relation-row" key={(item as Cadre).key}>
    <div><strong>{(item as Cadre).role}</strong><small>{(item as Cadre).studentName??'尚未可靠关联在读学生'} · {(item as Cadre).enabled?'授权启用':'已停用'}</small><small>账号标识：{(item as Cadre).accountId.slice(0,8)}…</small></div>
    {(item as Cadre).studentId&&<div className="relation-row-actions"><button type="button" className="record-refresh" onClick={()=>onStudent((item as Cadre).studentId!)}>查看档案</button><button type="button" className="record-refresh" onClick={()=>onEvents((item as Cadre).studentId!)}>关联事件</button></div>}
   </article>)}
   {tab==='students'&&matching.map(item=><article className="relation-row" key={(item as Student).id}>
    <div><strong>{(item as Student).name}</strong><small>学号 {(item as Student).student_no||'未登记'} · 当前班级成员</small></div>
    <div className="relation-row-actions"><button type="button" className="record-refresh" onClick={()=>onStudent((item as Student).id)}>查看档案</button><button type="button" className="record-refresh" onClick={()=>onEvents((item as Student).id)}>关联事件</button></div>
   </article>)}
  </div>
  {!busy&&!error&&snapshot&&matching.length===0&&<p className="muted">当前范围没有符合条件的用户关系。</p>}
  <p className="muted">家长关系尚未接入可信监护人绑定表：不根据电话号码、学生姓名或沟通记录猜测亲属关系，也不生成虚假家长账号。角色和人员调整仍在原正式系统进行。</p>
 </section>;
}
