import {useEffect,useRef,useState} from 'react';
import {CLASS_RECORD_KINDS,describeClassRecord,exportRecordPageCsv} from '../lib/class-records.mjs';
import type {StudentItem} from '../lib/bridge';
import {DutyAdvisorPanel} from './DutyAdvisorPanel';
import {AttendanceDigestPanel} from './AttendanceDigestPanel';
type Filters={studentId?:string;startOn?:string;endOn?:string};
type PageData={items:Record<string,unknown>[];count:number|null;page:number;pageSize:number;students:StudentItem[]};
type Load=(kind:string,page:number,size:number,filters:Filters)=>Promise<PageData>;
export function ClassRecordsPanel({load}:{load:Load}){
 const [kind,setKind]=useState('考勤'),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(10);
 const [studentId,setStudentId]=useState(''),[startOn,setStartOn]=useState(''),[endOn,setEndOn]=useState('');
 const [roster,setRoster]=useState<StudentItem[]>([]);
 const [snapshot,setSnapshot]=useState<{key:string;data:PageData}|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
 const queryKey=`${kind}:${page}:${pageSize}:${studentId}:${startOn}:${endOn}:${revision}`;
 const result=snapshot?.key===queryKey?snapshot.data:null;
 const seq=useRef(0);
 useEffect(()=>{
  const current=++seq.current;setBusy(true);setError('');setSnapshot(null);
  load(kind,page,pageSize,{studentId,startOn,endOn}).then(data=>{if(seq.current===current){setSnapshot({key:queryKey,data});setRoster(data.students)}})
   .catch(()=>{if(seq.current===current)setError('当前记录读取失败或授权已失效，请核对日期、学生与读取权限后重试。')})
   .finally(()=>{if(seq.current===current)setBusy(false)});
  return ()=>{seq.current++};
 },[kind,page,pageSize,studentId,startOn,endOn,revision,load]);
 const total=result?.count??null;
 const pages=total===null?null:Math.max(1,Math.ceil(total/pageSize));
 const names=new Map((result?.students??[]).map(s=>[s.id,s.name]));
 function downloadCurrentPage(){
  if(!result||!result.items.length||kind==='家校沟通')return;
  const csv=exportRecordPageCsv(kind,result.items,result.students);
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=`班务记录_${kind}_第${page}页.csv`;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
 }
 return <section className="panel class-records" aria-label="班务记录中心">
  <div className="panel-head"><div><h2>班务记录中心</h2><p>班主任授权只读 · 六类真实记录 · 每页独立查询</p></div><span className="count">只读</span></div>
  <div className="record-tabs" role="group" aria-label="班务分类">{CLASS_RECORD_KINDS.map(item=><button key={item} type="button" aria-pressed={kind===item} className={kind===item?'active':''} onClick={()=>{setKind(item);setPage(1)}}>{item}</button>)}</div>
  <div className="record-filters">
   <label>学生 <select aria-label="按学生筛选班务记录" value={studentId} onChange={e=>{setStudentId(e.target.value);setPage(1)}}><option value="">全部在读学生</option>{roster.map(st=><option key={st.id} value={st.id}>{st.student_no} · {st.name}</option>)}</select></label>
   <label>开始日期 <input aria-label="记录开始日期" type="date" value={startOn} onChange={e=>{setStartOn(e.target.value);setPage(1)}}/></label>
   <label>结束日期 <input aria-label="记录结束日期" type="date" value={endOn} onChange={e=>{setEndOn(e.target.value);setPage(1)}}/></label>
   <button type="button" className="record-refresh" onClick={()=>{setStudentId('');setStartOn('');setEndOn('');setPage(1)}}>清除筛选</button>
  </div>
  <div className="record-toolbar"><span aria-live="polite" className="muted">{busy?'正在读取…':error?'读取失败':total===null?'总数未知':`符合条件 ${total} 条`}</span>
   <label>每页 <select aria-label="班务记录每页数量" value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1)}}>{[5,10,20].map(v=><option key={v} value={v}>{v} 条</option>)}</select></label>
   <button type="button" className="record-refresh" disabled={busy} onClick={()=>setRevision(v=>v+1)}>刷新</button>
   <button type="button" className="record-refresh" disabled={busy||!result?.items.length||kind==='家校沟通'} onClick={downloadCurrentPage}>导出当前页 CSV</button>
  </div>
  {kind==='家校沟通'&&<p className="record-sensitive">家校沟通含敏感谈话内容，仅班主任授权查看；本入口禁用导出。请勿在公共场合投屏或转发截图。</p>}
  {error&&<p role="alert" className="notice error">{error}</p>}
  {!busy&&!error&&result?.items.length===0&&<p className="muted">当前筛选下没有可见记录；已归档学生的历史记录请在旧版核对。</p>}
  <div className="record-list">{result?.items.map((record,i)=>{
   const row=describeClassRecord(kind,record);
   const student=names.get(String(record.student_id??''))??'学生（未找到或已归档）';
   return <article className="record-item" key={String(record.id??i)}><div className="record-item-head"><strong>{student}</strong><time>{row.date}</time></div><p>{row.description}</p></article>;
  })}</div>
  {kind==='考勤'&&result&&<AttendanceDigestPanel key={`${queryKey}:attendance-digest`} records={result.items} students={result.students}/>}
  {kind==='值日'&&result&&<DutyAdvisorPanel key={`${queryKey}:duty-advisor`} records={result.items} students={result.students}/>}
  <div className="record-pagination" role="navigation" aria-label="班务记录分页"><button type="button" disabled={busy||page<=1} onClick={()=>setPage(v=>Math.max(1,v-1))}>上一页</button><span>第 {page} / {pages??'—'} 页</span><button type="button" disabled={busy||Boolean(error)||!result||(pages!==null&&page>=pages)||(!pages&&result.items.length<pageSize)} onClick={()=>setPage(v=>v+1)}>下一页</button></div>
  <p className="muted">导出仅包含当前已加载页的姓名、日期及业务摘要，不包含身份证、电话等身份信息。新建、更改、审批仍在旧版正式系统操作。</p>
 </section>;
}
