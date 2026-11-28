import {useEffect,useState} from 'react';
import {Search} from 'lucide-react';
import type {StudentItem} from '../lib/bridge';
import {pageStudents,PAGE_SIZES} from '../lib/list-view.mjs';

export function StudentsPanel({students,search,onSearch,loading,onSelect,selectedId}:{students:StudentItem[];search:string;onSearch:(s:string)=>void;loading:boolean;onSelect?:(id:string)=>void;selectedId?:string}){
 const [page,setPage]=useState(1);
 const [pageSize,setPageSize]=useState(10);
 useEffect(()=>setPage(1),[search,students]);
 const result=pageStudents(students,search,page,pageSize);
 return <section className="panel" aria-label="学生名单">
  <div className="panel-head"><div><h2>学生名单</h2><p>只显示姓名、学号；不读取身份证、电话、住址或家长信息。</p></div><span className="count" aria-live="polite">{loading?'读取中':`筛选 ${result.total} 人`}</span></div>
  <div className="roster-controls">
   <label className="search"><Search size={17}/><input value={search} onChange={e=>onSearch(e.target.value)} placeholder="搜索姓名、学号" aria-label="搜索学生"/></label>
   <label className="roster-page-size">每页 <select aria-label="学生每页数量" value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1)}}>{PAGE_SIZES.map(n=><option key={n} value={n}>{n} 人</option>)}</select></label>
  </div>
  <div className="student-grid">{result.items.map(s=><div className={`student-row ${selectedId===s.id?'student-selected':''}`} key={s.id}><span className="avatar" aria-hidden="true">{s.name.slice(-1)}</span><div><strong>{s.name}</strong><small>{s.student_no||'未填写学号'}</small></div>{onSelect&&<button className="student-open" type="button" onClick={()=>onSelect(s.id)} aria-label={`查看${s.name}的业务档案`}>查看档案</button>}</div>)}</div>
  {!loading&&result.total===0&&<p className="muted" role="status">{search.trim()?'没有符合搜索条件的学生。':'当前没有可查看的学生，或尚未获得读取权限。'}</p>}
  {result.total>0&&<div className="roster-pagination" role="navigation" aria-label="学生分页">
   <button type="button" disabled={loading||result.page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>上一页</button>
   <span aria-live="polite">第 {result.page}/{result.pages} 页 · 共 {result.total} 人</span>
   <button type="button" disabled={loading||result.page>=result.pages} onClick={()=>setPage(p=>p+1)}>下一页</button>
  </div>}
 </section>;
}
