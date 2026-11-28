import {Search} from 'lucide-react';
import type {StudentItem} from '../lib/bridge';
export function StudentsPanel({students,search,onSearch,loading,onSelect,selectedId}:{students:StudentItem[];search:string;onSearch:(s:string)=>void;loading:boolean;onSelect?:(id:string)=>void;selectedId?:string}){
 const filtered=students.filter(s=>`${s.name} ${s.student_no}`.includes(search.trim()));
 return <section className="panel"><div className="panel-head"><div><h2>学生名单</h2><p>班干部只显示学号和姓名；不读取身份证、电话、住址或家长信息。</p></div><span className="count">{loading?'读取中':`${filtered.length} 人`}</span></div>
 <label className="search"><Search size={17}/><input value={search} onChange={e=>onSearch(e.target.value)} placeholder="搜索姓名、学号" aria-label="搜索学生"/></label>
 <div className="student-grid">{filtered.map(s=><div className={`student-row ${selectedId===s.id?'student-selected':''}`} key={s.id}><span className="avatar">{s.name.slice(-1)}</span><div><strong>{s.name}</strong><small>{s.student_no||'未填写学号'}</small></div>{onSelect&&<button className="student-open" type="button" onClick={()=>onSelect(s.id)} aria-label={`查看${s.name}的业务档案`}>查看档案</button>}</div>)}</div>
 {!loading&&filtered.length===0&&<p className="muted">暂无可查看学生，请核对授权或搜索条件。</p>}</section>
}
