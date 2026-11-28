import {useEffect,useRef,useState} from 'react';
import {CLASS_RECORD_KINDS,describeClassRecord} from '../lib/class-records.mjs';
import type {StudentItem} from '../lib/bridge';
type PageData={items:Record<string,unknown>[];count:number|null;page:number;pageSize:number;students:StudentItem[]};
type Load=(kind:string,page:number,size:number)=>Promise<PageData>;
export function ClassRecordsPanel({load}:{load:Load}){
 const [kind,setKind]=useState('考勤'),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(10);
 const [snapshot,setSnapshot]=useState<{key:string;data:PageData}|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
 const queryKey=`${kind}:${page}:${pageSize}:${revision}`;
 const result=snapshot?.key===queryKey?snapshot.data:null;
 const seq=useRef(0);
 useEffect(()=>{
  const current=++seq.current;setBusy(true);setError('');setSnapshot(null);
  load(kind,page,pageSize).then(data=>{if(seq.current===current)setSnapshot({key:queryKey,data})})
   .catch(()=>{if(seq.current===current)setError('当前记录读取失败或授权已失效，请检查权限后重试。')})
   .finally(()=>{if(seq.current===current)setBusy(false)});
  return ()=>{seq.current++};
 },[kind,page,pageSize,revision,load]);
 const total=result?.count??null;
 const pages=total===null?null:Math.max(1,Math.ceil(total/pageSize));
 const names=new Map((result?.students??[]).map(s=>[s.id,s.name]));
 return <section className="panel class-records" aria-label="班务记录中心">
  <div className="panel-head"><div><h2>班务记录中心</h2><p>班主任授权只读 · 每类记录独立查询 · 不修改正式数据</p></div><span className="count">只读</span></div>
  <div className="record-tabs" role="group" aria-label="班务分类">{CLASS_RECORD_KINDS.map(item=><button key={item} type="button" aria-pressed={kind===item} className={kind===item?'active':''} onClick={()=>{setKind(item);setPage(1)}}>{item}</button>)}</div>
  <div className="record-toolbar"><span aria-live="polite" className="muted">{busy?'正在读取…':error?'读取失败':total===null?'总数未知':`共 ${total} 条`}</span>
   <label>每页 <select aria-label="班务记录每页数量" value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1)}}>{[5,10,20].map(v=><option key={v} value={v}>{v} 条</option>)}</select></label>
   <button type="button" className="record-refresh" disabled={busy} onClick={()=>setRevision(v=>v+1)}>刷新当前分类</button></div>
  {kind==='家校沟通'&&<p className="record-sensitive">家校沟通含敏感谈话内容，仅班主任在授权后查看；请勿在公共场合投屏或转发截图。</p>}
  {error&&<p role="alert" className="notice error">{error}</p>}
  {!busy&&!error&&result?.items.length===0&&<p className="muted">当前分类没有可见记录；不代表其他班级或已归档学生没有记录。</p>}
  <div className="record-list">{result?.items.map((record,i)=>{
   const row=describeClassRecord(kind,record);
   const student=names.get(String(record.student_id??''))??'学生（未找到或已归档）';
   return <article className="record-item" key={String(record.id??i)}><div className="record-item-head"><strong>{student}</strong><time>{row.date}</time></div><p>{row.description}</p></article>;
  })}</div>
  <div className="record-pagination" role="navigation" aria-label="班务记录分页"><button type="button" disabled={busy||page<=1} onClick={()=>setPage(v=>Math.max(1,v-1))}>上一页</button><span>第 {page} / {pages??'—'} 页</span><button type="button" disabled={busy||Boolean(error)||!result||(pages!==null&&page>=pages)||(!pages&&result.items.length<pageSize)} onClick={()=>setPage(v=>v+1)}>下一页</button></div>
  <p className="muted">基于当前班级未归档学生关联查询；已归档学生的历史记录请在旧版系统核对。班干部暂不开放此入口，避免越权查看。</p>
 </section>;
}
