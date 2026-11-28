import {useEffect,useRef,useState} from 'react';
import type {StudentItem,DossierPage} from '../lib/bridge';
import {Button} from './Common';

const SECTIONS=['考勤','请假','违纪','积分','值日'] as const;
type SectionName=typeof SECTIONS[number];
type FetchPage=(section:SectionName,page:number,pageSize:number)=>Promise<DossierPage>;

function DossierSection({name,studentId,fetchPage}:{name:SectionName;studentId:string;fetchPage:FetchPage}){
 const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(5);
 const [result,setResult]=useState<DossierPage|null>(null);
 const [error,setError]=useState(''),[loading,setLoading]=useState(false);
 const seq=useRef(0);
 useEffect(()=>{setPage(1);setResult(null);setError('');},[studentId,name]);
 useEffect(()=>{
  const current=++seq.current;
  setLoading(true);setResult(null);setError('');
  fetchPage(name,page,pageSize).then(data=>{if(current===seq.current)setResult(data)})
  .catch(()=>{if(current===seq.current)setError('该分类当前无法读取，请在旧版核对。')})
  .finally(()=>{if(current===seq.current)setLoading(false)});
  return ()=>{seq.current++};
 },[name,studentId,page,pageSize,fetchPage]);
 const total=result?.count;
 const pages=total===null||total===undefined?null:Math.max(1,Math.ceil(total/pageSize));
 return <article className="dossier-section" aria-label={`${name}记录`}><h3>{name}</h3>
  <div className="dossier-toolbar"><span className="muted">{loading?'正在加载…':error?'读取失败':total===null||total===undefined?'总数未知':`共 ${total} 条`}</span>
   <label>每页 <select aria-label={`${name}每页条数`} value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1)}}>{[5,10,20].map(n=><option key={n} value={n}>{n} 条</option>)}</select></label></div>
  {error&&<p role="alert" className="muted">{error}</p>}
  {!loading&&!error&&result&&result.items.length===0&&<p className="muted">本页没有记录{page>1?'，请返回上一页':''}</p>}
  {!loading&&!error&&result?.items.map((item,i)=><div className="dossier-event" key={String(item.id??`${page}-${i}`)}><strong>{String(item.on_date??item.happened_on??item.start_on??'记录')}</strong><span>{String(item.status??item.category??item.rule_code??'已登记')}</span></div>)}
  <div className="dossier-pager"><button type="button" disabled={loading||page===1} onClick={()=>setPage(p=>Math.max(1,p-1))}>上一页</button>
   <span>{page} / {pages??'?'}</span><button type="button" disabled={loading||Boolean(error)||!result||Boolean(pages&&page>=pages)||(!pages&&result.items.length<pageSize)} onClick={()=>setPage(p=>p+1)}>下一页</button></div>
 </article>;
}
export function StudentDossierPanel({student,fetchPage,onClose}:{student?:StudentItem;fetchPage:FetchPage;onClose:()=>void}){
 return <section className="panel dossier-panel" aria-label="学生业务档案"><div className="panel-head"><div><h2>业务档案 · {student?.name??'学生'}</h2><p>班主任授权只读，按页查询数据库完整历史；各分类独立分页。</p></div><Button secondary onClick={onClose}>关闭档案</Button></div>
  {student&&<div className="dossier-grid">{SECTIONS.map(name=><DossierSection key={`${student.id}:${name}`} name={name} studentId={student.id} fetchPage={fetchPage}/>)}</div>}
 </section>;
}
