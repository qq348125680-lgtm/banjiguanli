import {withReadDeadline} from '../lib/read-deadline.mjs';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {StudentItem,DossierPage} from '../lib/bridge';
import {Button} from './Common';

const SECTIONS=['考勤','请假','违纪','积分','值日','家校沟通'] as const;
type SectionName=typeof SECTIONS[number];
type FetchPage=(section:SectionName,page:number,pageSize:number)=>Promise<DossierPage>;
type CaseSummary={counts:Record<string,number>;total:number};
type FetchCaseSummary=(studentId:string)=>Promise<CaseSummary>;
const CASE_LABELS=['待分派','处理中','待复核','已结案'] as const;

function DossierSection({name,studentId,fetchPage,onCount}:{name:SectionName;studentId:string;fetchPage:FetchPage;onCount:(kind:SectionName,count:number|null)=>void}){
 const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(5);
 const [result,setResult]=useState<DossierPage|null>(null);
 const [error,setError]=useState(''),[loading,setLoading]=useState(false),[revision,setRevision]=useState(0);
 const seq=useRef(0);
 useEffect(()=>{setPage(1);setResult(null);setError('');},[studentId,name]);
 useEffect(()=>{
  const current=++seq.current;
  setLoading(true);setResult(null);setError('');
  withReadDeadline(()=>fetchPage(name,page,pageSize)).then(data=>{if(current===seq.current){setResult(data);onCount(name,data.count)}})
  .catch(()=>{if(current===seq.current){setError('该分类当前无法读取，请在旧版核对。');onCount(name,null)}})
  .finally(()=>{if(current===seq.current)setLoading(false)});
  return ()=>{seq.current++};
 },[name,studentId,page,pageSize,fetchPage,onCount,revision]);
 const total=result?.count;
 const pages=total===null||total===undefined?null:Math.max(1,Math.ceil(total/pageSize));
 return <article className="dossier-section" aria-label={`${name}记录`}><h3>{name}</h3>
  <div className="dossier-toolbar"><span className="muted">{loading?'正在加载…':error?'读取失败':total===null||total===undefined?'总数未知':`共 ${total} 条`}</span>
   <label>每页 <select aria-label={`${name}每页条数`} value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1)}}>{[5,10,20].map(n=><option key={n} value={n}>{n} 条</option>)}</select></label></div>
  {error&&<div role="alert" className="dossier-error"><p className="muted">{error}</p><button type="button" className="record-refresh" disabled={loading} onClick={()=>setRevision(x=>x+1)}>重新读取此分类</button></div>}
  {!loading&&!error&&result&&result.items.length===0&&<p className="muted">本页没有记录{page>1?'，请返回上一页':''}</p>}
  {!loading&&!error&&result?.items.map((item,i)=><div className="dossier-event" key={String(item.id??`${page}-${i}`)}><strong>{String(item.on_date??item.happened_on??item.start_on??item.contacted_on??'记录')}</strong><span>{String(item.status??item.category??item.rule_code??item.method??'已登记')}</span></div>)}
  <div className="dossier-pager"><button type="button" disabled={loading||page===1} onClick={()=>setPage(p=>Math.max(1,p-1))}>上一页</button>
   <span>{page} / {pages??'?'}</span><button type="button" disabled={loading||Boolean(error)||!result||Boolean(pages&&page>=pages)||(!pages&&result.items.length<pageSize)} onClick={()=>setPage(p=>p+1)}>下一页</button></div>
 </article>;
}
export function StudentDossierPanel({student,fetchPage,fetchCaseSummary,onClose,onOpenCases,onOpenGuardians}:{student?:StudentItem;fetchPage:FetchPage;fetchCaseSummary?:FetchCaseSummary;onClose:()=>void;onOpenCases?:(studentId:string)=>void;onOpenGuardians?:(studentId:string)=>void}){
 const [counts,setCounts]=useState<Record<string,number|null>>({});
 const [caseMetrics,setCaseMetrics]=useState<CaseSummary|null>(null);
 const [caseMetricsError,setCaseMetricsError]=useState(false);
 const [caseRefresh,setCaseRefresh]=useState(0);
 useEffect(()=>{
  let active=true;
  setCaseMetrics(null);setCaseMetricsError(false);
  if(student?.id&&fetchCaseSummary){
   withReadDeadline(()=>fetchCaseSummary(student.id)).then(data=>{
    if(active)setCaseMetrics(data);
   }).catch(()=>{if(active)setCaseMetricsError(true)});
  }
  return ()=>{active=false};
 },[student?.id,fetchCaseSummary,caseRefresh]);
 useEffect(()=>{setCounts({})},[student?.id]);
 const captureCount=useCallback((kind:SectionName,count:number|null)=>setCounts(previous=>previous[kind]===count?previous:{...previous,[kind]:count}),[]);
 const complete=SECTIONS.every(kind=>typeof counts[kind]==='number');
 const total=complete?SECTIONS.reduce((sum,kind)=>sum+(counts[kind]??0),0):null;
 return <section className="panel dossier-panel" aria-label="学生业务档案"><div className="panel-head"><div><h2>业务档案 · {student?.name??'学生'}</h2><p>班主任授权只读：考勤、请假、违纪、积分、值日及家校沟通，分类独立分页。</p></div><div className="dossier-extra-actions">{student&&onOpenCases&&<Button secondary onClick={()=>onOpenCases(student.id)}>查看事件工单</Button>}{student&&onOpenGuardians&&<Button secondary onClick={()=>onOpenGuardians(student.id)}>家庭联系人关系</Button>}<Button secondary onClick={onClose}>关闭档案</Button></div></div>
  {student&&<div className="dossier-growth-summary"><strong>{total===null?'—':total}</strong><div><b>六类历史业务记录</b><small>{total===null?'正在核对各类别数量，或存在尚未读取成功的类别':'数量为各类别精确计数之和；事件工单需单独查看，不重复计入'}</small></div></div>}
  {student&&fetchCaseSummary&&<div className="dossier-case-metrics">
    <div className="dossier-case-metrics-heading"><strong>跟进工单办理情况</strong><button type="button" className="record-refresh" onClick={()=>setCaseRefresh(v=>v+1)}>刷新统计</button></div>
    {caseMetricsError?<p role="status" className="muted">事件工单统计未能完整读取，暂不显示数量。</p>:caseMetrics?
     <div className="dossier-case-metrics-grid"><div><b>{caseMetrics.total}</b><span>工单合计</span></div>{CASE_LABELS.map(state=><div key={state}><b>{caseMetrics.counts[state]}</b><span>{state}</span></div>)}</div>
     :<p className="muted">正在核对这名学生的完整事件工单数量…</p>}
    <p className="muted">工单与上方六类原始业务记录分开统计，不能将两者相加当作独立事件总数。</p>
  </div>}
  {student&&<div className="dossier-grid">{SECTIONS.map(name=><DossierSection key={`${student.id}:${name}`} name={name} studentId={student.id} fetchPage={fetchPage} onCount={captureCount}/>)}</div>}
 </section>;
}
