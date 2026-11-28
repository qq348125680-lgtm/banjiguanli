import {useEffect,useRef,useState} from 'react';
import {withReadDeadline} from '../lib/read-deadline.mjs';
import {GUARDIAN_RELATIONS,GUARDIAN_STATUSES,maskGuardianPhone,validateGuardianInput} from '../lib/guardian-links-api.mjs';
import type {StudentItem} from '../lib/bridge';

type GuardianRow={id:string;class_id:string;student_id:string;contact_name:string;relation:string;contact_phone:string;verification_status:string;verified_at:string|null;created_at:string;updated_at:string};
type Change={id:string;action:string;actor_id:string;from_status:string|null;to_status:string;note:string;created_at:string};
type Api={
 list:(classId:string,options:{page:number;pageSize:number;studentId:string;status:string})=>Promise<{items:GuardianRow[];count:number|null}>;
 history:(classId:string,id:string)=>Promise<Change[]>;
 findByRequestKey:(classId:string,key:string)=>Promise<GuardianRow|null>;
 create:(input:{classId:string;studentId:string;name:string;relation:string;phone:string;requestKey:string})=>Promise<string>;
 change:(id:string,action:string,note:string)=>Promise<{id:string;status:string}>;
};
type Props={api:Api;classId:string;students:StudentItem[];canWrite:boolean;initialStudentId?:string;onStudent:(id:string)=>void};
const newKey=()=>crypto.randomUUID();
export function GuardianLinksPanel({api,classId,students,canWrite,initialStudentId='',onStudent}:Props){
 const [records,setRecords]=useState<GuardianRow[]>([]),[count,setCount]=useState<number|null>(null);
 const [page,setPage]=useState(1),[filterStudent,setFilterStudent]=useState(initialStudentId),[filterStatus,setFilterStatus]=useState('全部');
 const [revision,setRevision]=useState(0),[loading,setLoading]=useState(true),[problem,setProblem]=useState(''),[feedback,setFeedback]=useState('');
 const [studentId,setStudentId]=useState(initialStudentId),[contactName,setContactName]=useState(''),[relation,setRelation]=useState('母亲'),[phone,setPhone]=useState('');
 const [requestKey,setRequestKey]=useState(newKey),[uncertain,setUncertain]=useState(false),[busyId,setBusyId]=useState('');
 const [notes,setNotes]=useState<Record<string,string>>({}),[revealed,setRevealed]=useState<Record<string,boolean>>({});
 const [expanded,setExpanded]=useState(''),[history,setHistory]=useState<Record<string,Change[]>>({}),[historyBusy,setHistoryBusy]=useState(false);
 const current=useRef(0),lock=useRef(false);
 const names=new Map(students.map(s=>[s.id,s.name]));
 const resetDraft=()=>{setStudentId(initialStudentId);setContactName('');setRelation('母亲');setPhone('');setRequestKey(newKey());setUncertain(false)};
 useEffect(()=>{
  const seq=++current.current;
  setRecords([]);setCount(null);setLoading(true);setProblem('');
  withReadDeadline(()=>api.list(classId,{page,pageSize:10,studentId:filterStudent,status:filterStatus}))
   .then(v=>{if(current.current===seq){setRecords(v.items);setCount(v.count)}})
   .catch(()=>{if(current.current===seq)setProblem('家庭联系人数据未读取成功，请确认已安装独立测试模块及班主任授权。')})
   .finally(()=>{if(current.current===seq)setLoading(false)});
  return ()=>{current.current++};
 },[api,classId,page,filterStudent,filterStatus,revision]);
 const create=async(retry=false)=>{
  if(lock.current||!canWrite||!studentId||contactName.trim().length<2||phone.trim().length<7||(uncertain&&!retry))return;
  const input={classId,studentId,name:contactName,relation,phone,requestKey};
  try{validateGuardianInput(input)}
  catch(e){setProblem(e instanceof Error?e.message:'联系人资料不合法，请检查后重新填写');return}
  lock.current=true;setBusyId('create');setProblem('');setFeedback('');
  try{
   const id=await api.create(input);
   resetDraft();setFeedback('联系人关系已登记为“待核实”，编号 '+id.slice(0,8)+'…。确认身份后方可标记已核实。');
   setPage(1);setFilterStatus('全部');setRevision(v=>v+1);
  }catch(e){
   setUncertain(true);
   setProblem('本次创建结果尚未核实。不要另换请求编号重复创建；请先核对原请求：'+(e instanceof Error?e.message:'操作失败'));
  }finally{lock.current=false;setBusyId('')}
 };
 const verify=async()=>{
  if(lock.current||!uncertain)return;
  lock.current=true;setBusyId('verify');setProblem('');setFeedback('');
  try{
   const row=await api.findByRequestKey(classId,requestKey);
   if(row){resetDraft();setFeedback('服务器已找到本次联系人登记，不再重复创建。');setRevision(v=>v+1)}
   else setProblem('服务器暂未找到本次请求；请稍后用相同编号核对，避免重复录入。');
  }catch{setProblem('暂时无法核对登记状态，已保留本次请求内容与编号。')}
  finally{lock.current=false;setBusyId('')}
 };
 const change=async(id:string,action:'verify'|'deactivate'|'reactivate')=>{
  if(lock.current||!canWrite||!(notes[id]??'').trim())return;
  lock.current=true;setBusyId(id);setProblem('');setFeedback('');
  try{
   const result=await api.change(id,action,notes[id]);
   setFeedback('服务器已确认关系状态变为：'+result.status+'。');
   setNotes(p=>({...p,[id]:''}));
   setHistory(p=>{const q={...p};delete q[id];return q});
   setRevision(v=>v+1);
  }catch(e){setProblem('核实/停用结果尚未确认，请先刷新当前记录及流水后再操作：'+(e instanceof Error?e.message:'网络失败'))}
  finally{lock.current=false;setBusyId('')}
 };
 const toggleHistory=async(id:string)=>{
  if(expanded===id){setExpanded('');return}
  setExpanded(id);setHistoryBusy(true);
  try{const rows=await withReadDeadline(()=>api.history(classId,id));setHistory(p=>({...p,[id]:rows}))}
  catch{setProblem('联系人操作流水读取失败，请重新验证班主任身份。')}
  finally{setHistoryBusy(false)}
 };
 const pages=count===null?null:Math.max(1,Math.ceil(count/10));
 return <section className="panel guardian-center" aria-label="家庭联系人关系">
  <div className="panel-head"><div><h2>家庭联系人关系</h2><p>班主任登记 → 核实身份 → 状态维护 → 留存核实流水</p></div><span className="count">{loading?'读取中':count===null?'总数未知':count+' 位联系人'}</span></div>
  <p className="muted">此处登记的是学生家庭联系人的核实状态，<strong>不代表家长已注册系统账号</strong>。不会从电话、姓名或沟通记录自动推断监护人关系。</p>
  {canWrite&&<form className="guardian-create" onSubmit={e=>{e.preventDefault();void create()}}>
   <strong>登记待核实联系人</strong>
   <div className="case-form-grid">
    <label>关联学生<select required disabled={Boolean(busyId)||uncertain} value={studentId} onChange={e=>setStudentId(e.target.value)}><option value="">选择在读学生</option>{students.map(s=><option value={s.id} key={s.id}>{s.student_no} · {s.name}</option>)}</select></label>
    <label>联系人关系<select disabled={Boolean(busyId)||uncertain} value={relation} onChange={e=>setRelation(e.target.value)}>{GUARDIAN_RELATIONS.map(v=><option value={v} key={v}>{v}</option>)}</select></label>
    <label>联系人姓名<input required maxLength={80} minLength={2} disabled={Boolean(busyId)||uncertain} value={contactName} onChange={e=>setContactName(e.target.value)} placeholder="依据实际资料填写"/></label>
    <label>联系电话<input required type="tel" maxLength={25} minLength={7} disabled={Boolean(busyId)||uncertain} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="用于后续联系，避免复制无关号码"/></label>
   </div>
   <div className="case-create-actions"><button type="submit" className="button" disabled={Boolean(busyId)||uncertain||!studentId||contactName.trim().length<2||phone.trim().length<7}>登记为待核实</button>
   {uncertain&&<><button type="button" className="button secondary" disabled={Boolean(busyId)} onClick={()=>void verify()}>核对上次请求</button><button type="button" className="button secondary" disabled={Boolean(busyId)} onClick={()=>void create(true)}>使用原编号重试</button></>}</div>
  </form>}
  {!canWrite&&<p className="notice">当前写入未启用：仅查询已有的授权联系人关系，不能修改核实状态。</p>}
  <div className="guardian-filter">
   <label>学生<select value={filterStudent} onChange={e=>{setFilterStudent(e.target.value);setPage(1)}}><option value="">全部在读学生</option>{students.map(s=><option key={s.id} value={s.id}>{s.student_no} · {s.name}</option>)}</select></label>
   <label>核实状态<select value={filterStatus} onChange={e=>{setFilterStatus(e.target.value);setPage(1)}}><option>全部</option>{GUARDIAN_STATUSES.map(v=><option key={v}>{v}</option>)}</select></label>
   <button type="button" className="record-refresh" disabled={loading} onClick={()=>setRevision(v=>v+1)}>刷新列表</button>
  </div>
  {problem&&<p className="notice error" role="alert">{problem}</p>}
  {feedback&&<p className="notice success" role="status">{feedback}</p>}
  <div className="guardian-list">{records.map(item=><article className="guardian-row" key={item.id}>
   <div className="guardian-row-head"><strong>{item.contact_name}</strong><span>{item.relation}</span><span className="event-state">{item.verification_status}</span></div>
   <p className="muted">学生：{names.get(item.student_id)??'当前花名册中无法确认该学生'} · {item.created_at?.slice(0,10)}</p>
   <div className="guardian-phone"><span>联系电话：{revealed[item.id]?item.contact_phone:maskGuardianPhone(item.contact_phone)}</span><button type="button" className="record-refresh" onClick={()=>setRevealed(p=>({...p,[item.id]:!p[item.id]}))}>{revealed[item.id]?'隐藏号码':'查看号码'}</button></div>
   <div className="case-options"><button type="button" className="record-refresh" onClick={()=>onStudent(item.student_id)}>学生档案</button><button type="button" className="record-refresh" onClick={()=>void toggleHistory(item.id)}>{expanded===item.id?'收起流水':'核实流水'}</button></div>
   {expanded===item.id&&<div className="case-history"><strong>联系人核实历史</strong>{historyBusy?<p className="muted">读取中…</p>:(history[item.id]??[]).map(h=><div className="case-history-item" key={h.id}><time>{h.created_at.slice(0,16).replace('T',' ')}</time><b>{h.action}</b><span>{h.from_status??'未登记'} → {h.to_status}</span><p>{h.note||'初次登记'}</p></div>)}</div>}
   {canWrite&&<div className="guardian-actions"><label>核实依据或停用原因<textarea rows={2} maxLength={300} value={notes[item.id]??''} onChange={e=>setNotes(p=>({...p,[item.id]:e.target.value}))} placeholder="登记人工核实方式，避免填写额外敏感详情"/></label><div>
    {item.verification_status==='待核实'&&<button type="button" className="button" disabled={Boolean(busyId)||!(notes[item.id]??'').trim()} onClick={()=>void change(item.id,'verify')}>确认已核实</button>}
    {item.verification_status!=='已失效'&&<button type="button" className="button secondary" disabled={Boolean(busyId)||!(notes[item.id]??'').trim()} onClick={()=>void change(item.id,'deactivate')}>标记已失效</button>}
    {item.verification_status==='已失效'&&<button type="button" className="button secondary" disabled={Boolean(busyId)||!(notes[item.id]??'').trim()} onClick={()=>void change(item.id,'reactivate')}>恢复待核实</button>}
   </div></div>}
  </article>)}</div>
  {!loading&&!problem&&count===0&&<div className="preview-empty">尚未登记家庭联系人关系。此处不会根据已有沟通记录自动生成家长身份。</div>}
  <div className="record-pagination"><button type="button" disabled={loading||page<=1} onClick={()=>setPage(v=>v-1)}>上一页</button><span>第 {page} / {pages??'—'} 页</span><button type="button" disabled={loading||!records.length||(pages!==null&&page>=pages)} onClick={()=>setPage(v=>v+1)}>下一页</button></div>
 </section>;
}
