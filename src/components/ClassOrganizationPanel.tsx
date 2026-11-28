import {withReadDeadline} from '../lib/read-deadline.mjs';
import {useEffect,useRef,useState} from 'react';
type Lookup={data:any;error:string|null};
type Snapshot={students:Lookup;rooms:Lookup;beds:Lookup;delegates:Lookup;seat:Lookup};
type Props={load:()=>Promise<Snapshot>};
export function ClassOrganizationPanel({load}:Props){
 const [tab,setTab]=useState<'seat'|'dorm'|'cadre'>('seat');
 const [data,setData]=useState<Snapshot|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const [refresh,setRefresh]=useState(0);
 const seq=useRef(0);
 useEffect(()=>{
  const version=++seq.current;setBusy(true);setData(null);setError('');
  withReadDeadline(load).then(v=>{if(seq.current===version)setData(v)})
   .catch(()=>{if(seq.current===version)setError('班级组织资料无法读取，请重新验证授权。')})
   .finally(()=>{if(seq.current===version)setBusy(false)});
  return ()=>{seq.current++};
 },[load,refresh]);
 const students=Array.isArray(data?.students.data)?data.students.data:[];
 const names=new Map(students.map((s:any)=>[s.id,s.name]));
 const rooms=Array.isArray(data?.rooms.data)?data.rooms.data:[];
 const beds=Array.isArray(data?.beds.data)?data.beds.data:[];
 const delegates=Array.isArray(data?.delegates.data)?data.delegates.data:[];
 const notices=[data?.students.error,data?.rooms.error,data?.beds.error,data?.delegates.error,data?.seat.error].filter(Boolean);
 return <section className="panel organization-panel" aria-label="班级组织">
  <div className="panel-head"><div><h2>座位 · 宿舍 · 班干部</h2><p>只读查看班级已登记信息；不自动分配座位、床位或干部权限。</p></div><span className="count">班主任</span></div>
  <div className="record-tabs" role="group" aria-label="班级组织分类">{([['seat','座位'],['dorm','宿舍'],['cadre','班干部']] as const).map(([value,label])=><button type="button" key={value} className={tab===value?'active':''} aria-pressed={tab===value} onClick={()=>setTab(value)}>{label}</button>)}</div>
  <div className="record-toolbar"><span className="muted" aria-live="polite">{busy?'读取中…':error?'读取失败':'只显示当前班级已授权的记录'}</span><button type="button" className="record-refresh" disabled={busy} onClick={()=>setRefresh(v=>v+1)}>刷新</button></div>
  {error&&<p role="alert" className="notice error">{error}</p>}
  {notices.length>0&&<p role="status" className="notice error">{notices.join('；')}；未读取成功的栏目不代表没有数据。</p>}
  {!busy&&data&&tab==='seat'&&<><p className="muted">按现有座位号展示。未登记座位号的学生列在下方，不擅自安排位置。{data.seat.data&&data.seat.data.seat_rows?` 原设置 ${data.seat.data.seat_rows} 行 × ${data.seat.data.seat_cols} 列。`:''}</p>
   <div className="org-grid">{[...students].sort((a:any,b:any)=>(a.seat_no??Infinity)-(b.seat_no??Infinity)).map((s:any)=><div className="org-item" key={s.id}><strong>{s.seat_no?'座位 '+s.seat_no:'待分配'}</strong><span>{s.name}</span><small>{s.student_no||'未填学号'}{s.group_name?' · '+s.group_name:''}</small></div>)}</div>
   {students.length===0&&!data.students.error&&<p className="muted">暂无可见在读学生。</p>}</>}
  {!busy&&data&&tab==='dorm'&&<><p className="muted">仅展示班级已关联宿舍与床位，空床位不会自动填写学生。</p>
   <div className="org-room-grid">{rooms.map((room:any)=><article key={room.id} className="org-room"><h3>{room.room_no||'未命名宿舍'}</h3><div>{beds.filter((bed:any)=>bed.room_id===room.id).map((bed:any)=><p key={String(bed.bed_no)}><strong>{bed.bed_no} 号床</strong><span>{names.get(bed.student_id)||'空床位或学生已归档'}</span></p>)}</div></article>)}</div>
   {rooms.length===0&&!data.rooms.error&&<p className="muted">暂无已关联的宿舍房间。</p>}</>}
  {!busy&&data&&tab==='cadre'&&<><p className="muted">按数据库授权实际状态展示，不通过姓名推断 UID 或新增权限。</p>
   <div className="org-grid">{delegates.map((d:any,i:number)=><article key={String(d.student_id??i)+':'+i} className="org-item"><strong>{d.duty||'未设置职责'}</strong><span>{names.get(d.student_id)||'未关联在读学生'}</span><small>{d.enabled?'授权启用':'已停用'} · {Array.isArray(d.permissions)&&d.permissions.length?d.permissions.join('、'):'未列出附加权限'}</small></article>)}</div>
   {delegates.length===0&&!data.delegates.error&&<p className="muted">暂无已登记的班干部授权。</p>}</>}
  <p className="muted">排座、换寝、调整授权及批量导入仍应通过旧版正式系统完成；当前入口不会写入数据库。</p>
 </section>;
}
