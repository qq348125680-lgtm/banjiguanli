import {useEffect,useMemo,useRef,useState} from 'react';
import type {StudentItem} from '../lib/bridge';
import {withReadDeadline} from '../lib/read-deadline.mjs';
import {CASE_KINDS,CASE_STATES} from '../lib/event-case-api.mjs';
import {schoolToday} from '../lib/case-deadline-model.mjs';

type CaseRow={id:string;class_id:string;student_id:string;kind:string;title:string;description:string;status:string;created_by:string;assigned_to:string|null;created_at:string;updated_at:string;closed_at:string|null;due_on:string|null;request_key?:string};
type CaseHistory={id:string;action:string;actor_id:string;from_status:string|null;to_status:string;previous_assignee:string|null;next_assignee:string|null;previous_due_on:string|null;next_due_on:string|null;note:string;created_at:string};
type Candidate={user_id:string;student_id:string|null;duty:string;enabled:boolean};
type Api={
 list:(classId:string,params:{page:number;pageSize:number;status:string;studentId?:string;caseId?:string})=>Promise<{items:CaseRow[];count:number|null}>;
 history:(classId:string,caseId:string)=>Promise<CaseHistory[]>;
 assignees:(classId:string)=>Promise<Candidate[]>;
 create:(params:{classId:string;studentId:string;kind:string;title:string;description:string;requestKey:string;sourceRecordId?:string})=>Promise<string>;
 findByRequestKey:(classId:string,requestKey:string)=>Promise<CaseRow|null>;
 transition:(id:string,action:string,assignee:string|null,note:string)=>Promise<{id:string;status:string}>;
 setDeadline:(id:string,dueOn:string|null,expectedDueOn:string|null,note:string)=>Promise<{id:string;status:string;due_on:string|null}>;
 sendNudge:(id:string,note:string)=>Promise<{id:string;case_id:string;status:string}>;
};
type Props={api:Api;classId:string;userId:string;owned:boolean;canWrite:boolean;students:StudentItem[];onStudent:(id:string)=>void;initialDraft?:{studentId:string;kind:string;title:string;sourceRecordId?:string}|null;initialStudentId?:string;initialCaseId?:string;initialStatus?:string};
const newKey=()=>crypto.randomUUID();
export function EventCaseBoard({api,classId,userId,owned,canWrite,students,onStudent,initialDraft,initialStudentId='',initialCaseId='',initialStatus='全部'}:Props){
 const [cases,setCases]=useState<CaseRow[]>([]),[count,setCount]=useState<number|null>(null);
 const [filter,setFilter]=useState(CASE_STATES.includes(initialStatus)?initialStatus:'全部'),[page,setPage]=useState(1),[revision,setRevision]=useState(0);
 const [studentScope,setStudentScope]=useState(initialStudentId),[caseScope,setCaseScope]=useState(initialCaseId);
 const [loading,setLoading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [studentId,setStudentId]=useState(initialDraft?.studentId??''),[kind,setKind]=useState(initialDraft&&CASE_KINDS.includes(initialDraft.kind)?initialDraft.kind:'考勤'),[title,setTitle]=useState(initialDraft?.title??''),[description,setDescription]=useState('');
 const [sourceRecordId,setSourceRecordId]=useState(initialDraft?.sourceRecordId??'');
 const [requestKey,setRequestKey]=useState(newKey),[uncertain,setUncertain]=useState(false);
 const [candidates,setCandidates]=useState<Candidate[]>([]),[candidateError,setCandidateError]=useState('');
 const [targetById,setTargetById]=useState<Record<string,string>>({}),[notes,setNotes]=useState<Record<string,string>>({}),[transferNotes,setTransferNotes]=useState<Record<string,string>>({});
 const [deadlineDrafts,setDeadlineDrafts]=useState<Record<string,string>>({}),[deadlineNotes,setDeadlineNotes]=useState<Record<string,string>>({});
 const [nudgeNotes,setNudgeNotes]=useState<Record<string,string>>({}),[sentNudges,setSentNudges]=useState<Record<string,boolean>>({});
 const [expandedId,setExpandedId]=useState(''),[history,setHistory]=useState<Record<string,CaseHistory[]>>({}),[historyBusy,setHistoryBusy]=useState(false);
 const [busyId,setBusyId]=useState('');
 const seq=useRef(0),actionLock=useRef(false);
 const names=useMemo(()=>new Map(students.map(x=>[x.id,x.name])),[students]);
 const actors=useMemo(()=>new Map(candidates.map(c=>[c.user_id,c.student_id?(names.get(c.student_id)??c.duty):c.duty])),[candidates,names]);
 const displayActor=(id:string|null|undefined)=>!id?'未指派':actors.get(id)??(id===userId?'当前账号':'账号 '+id.slice(0,8)+'…');
 const load=async()=>{
  const data=await withReadDeadline(()=>api.list(classId,{page,pageSize:10,status:filter,studentId:studentScope,caseId:caseScope}));
  setCases(data.items);setCount(data.count);return true;
 };
 useEffect(()=>{
  const current=++seq.current;setCases([]);setCount(null);setLoading(true);setError('');
  withReadDeadline(()=>api.list(classId,{page,pageSize:10,status:filter,studentId:studentScope,caseId:caseScope}))
   .then(v=>{if(seq.current===current){setCases(v.items);setCount(v.count)}})
   .catch(()=>{if(seq.current===current)setError('工单列表无法读取，可能是独立测试库尚未安装事件模块；请核对授权与网络。')})
   .finally(()=>{if(seq.current===current)setLoading(false)});
  return ()=>{seq.current++};
 },[api,classId,page,filter,studentScope,caseScope,revision]);
 useEffect(()=>{setPage(1)},[filter]);
 useEffect(()=>{
  setCandidates([]);setCandidateError('');
  if(!owned)return;
  let active=true;
  withReadDeadline(()=>api.assignees(classId)).then(result=>{if(active)setCandidates(result)})
   .catch(()=>{if(active)setCandidateError('负责人名单读取失败，暂时不能指派。')});
  return ()=>{active=false};
 },[api,classId,owned,revision]);
 const resetDraft=()=>{setStudentId('');setTitle('');setDescription('');setKind('考勤');setSourceRecordId('');setUncertain(false);setRequestKey(newKey())};
 const create=async()=>{
  if(actionLock.current||!canWrite||!studentId||title.trim().length<2||title.trim().length>80||description.length>1000)return;
  actionLock.current=true;setBusyId('create');setError('');setNotice('');
  try{
   const id=await api.create({classId,studentId,kind,title,description,requestKey,sourceRecordId});
   resetDraft();setNotice('工单已创建并保存，编号 '+id.slice(0,8)+'…，可以继续指派负责人。');
   setPage(1);setFilter('全部');setRevision(x=>x+1);
  }catch(e){
   setUncertain(true);
   setError('创建结果尚未核实。请先点“核对本次请求”，不得换编号重新创建；如需重试，将使用原请求号防重。'+(e instanceof Error?' '+e.message:''));
  }finally{setBusyId('');actionLock.current=false}
 };
 const verify=async()=>{
  if(actionLock.current||!uncertain)return;
  actionLock.current=true;setBusyId('verify');setError('');setNotice('');
  try{
   const found=await api.findByRequestKey(classId,requestKey);
   if(found){resetDraft();setNotice('已在服务器找到本次工单，未重复创建。');setFilter('全部');setPage(1);setRevision(v=>v+1)}
   else setError('目前未查到该请求，可能仍在处理。请稍后再次核对；如必须重试，请保持原请求编号不变。');
  }catch(e){setError('服务器核对失败，保持请求内容和编号：'+(e instanceof Error?e.message:'读取异常'))}
  finally{setBusyId('');actionLock.current=false}
 };
 const advance=async(row:CaseRow,action:'assign'|'reply'|'close'|'reopen')=>{
  if(actionLock.current||!canWrite)return;
  const candidate=targetById[row.id]??row.assigned_to??'';
  const note=action==='assign'?(transferNotes[row.id]??''):(notes[row.id]??'');
  if(action==='assign'&&(!candidate||candidate===row.assigned_to||(row.assigned_to!==null&&!note.trim())))return;
  if(action!=='assign'&&!note.trim())return;
  actionLock.current=true;setBusyId(row.id);setError('');setNotice('');
  try{
   const result=await api.transition(row.id,action,action==='assign'?candidate:null,note);
   setNotice('服务器已确认本次处理：'+result.status+'。正在刷新列表；请勿重复操作。');
   setNotes(p=>({...p,[row.id]:''}));setTransferNotes(p=>({...p,[row.id]:''}));
   setHistory(p=>{const q={...p};delete q[row.id];return q});
   try{await load()}catch{setError('服务器已处理成功，但页面刷新失败；请点击“重新读取”核对新状态。')}
   setRevision(v=>v+1);
  }catch(e){setError('本次处理结果尚未确认，切勿连续重复点击。请重新读取工单和处理流水核对：'+(e instanceof Error?e.message:'操作失败'))}
  finally{setBusyId('');actionLock.current=false}
 };
 const sendReminder=async(row:CaseRow)=>{
  if(actionLock.current||!owned||!canWrite||row.status!=='处理中'
   ||!row.assigned_to||!row.due_on||row.due_on>schoolToday())return;
  const note=nudgeNotes[row.id]??'';
  if(note.trim().length<2)return;
  actionLock.current=true;setBusyId(row.id);setError('');setNotice('');
  try{
   await api.sendNudge(row.id,note);
   setSentNudges(prev=>({...prev,[row.id]:true}));
   setNudgeNotes(prev=>({...prev,[row.id]:''}));
   setNotice('催办已写入工单流水，负责人在工作台刷新后可查看待反馈催办。');
   setHistory(prev=>{const copy={...prev};delete copy[row.id];return copy});
   setRevision(v=>v+1);
  }catch(e){
   setError('本次催办结果未确认，请查看处理流水或刷新催办待办后再操作：'+(e instanceof Error?e.message:'网络失败'));
  }finally{setBusyId('');actionLock.current=false}
 };
 const changeDeadline=async(row:CaseRow)=>{
  if(actionLock.current||!owned||!canWrite||row.status==='已结案')return;
  const next=(deadlineDrafts[row.id]??row.due_on??'')||null;
  const note=deadlineNotes[row.id]??'';
  if(next===row.due_on||note.trim().length<2)return;
  actionLock.current=true;setBusyId(row.id);setError('');setNotice('');
  try{
   const result=await api.setDeadline(row.id,next,row.due_on,note);
   setNotice('处理截止日期已在服务器确认：'+(result.due_on??'未设置')+'。');
   setDeadlineNotes(prev=>({...prev,[row.id]:''}));
   setDeadlineDrafts(prev=>{const copy={...prev};delete copy[row.id];return copy});
   setHistory(prev=>{const copy={...prev};delete copy[row.id];return copy});
   setRevision(v=>v+1);
  }catch(e){
   setError('期限修改结果尚未确认。请重新读取工单与处理流水核对，避免重复覆盖：'+(e instanceof Error?e.message:'网络失败'));
  }finally{setBusyId('');actionLock.current=false}
 };
 const toggleHistory=async(id:string)=>{
  if(expandedId===id){setExpandedId('');return}
  setExpandedId(id);setHistoryBusy(true);
  try{const rows=await withReadDeadline(()=>api.history(classId,id));setHistory(p=>({...p,[id]:rows}))}
  catch{setError('处理流水读取失败，请重新验证当前班级的访问权限')}
  finally{setHistoryBusy(false)}
 };
 const pages=count===null?null:Math.max(1,Math.ceil(count/10));
 const today=schoolToday();
 return <section className="panel case-board" aria-label="事件工单协作">
  <div className="panel-head"><div><h2>事件工单 · 协作闭环</h2><p>创建 → 指派负责人 → 处理反馈 → 班主任复核 → 结案归档</p></div><span className="count">{loading?'读取中':count===null?'总数未知':count+' 条工单'}</span></div>
  <p className="muted">本模块与原考勤、积分记录分开保存；所有状态变化写入处理流水。只在已安装事件工单迁移的授权测试环境开放业务写入。</p>
  {(studentScope||caseScope)&&<div className="event-linked-scope"><span>{caseScope?'当前定位一个指定事件工单':'学生事件工单档案 · '+(names.get(studentScope)??'授权学生')}</span><button type="button" className="record-refresh" onClick={()=>{setStudentScope('');setCaseScope('');setPage(1);setFilter('全部')}}>查看全部工单</button></div>}
  {canWrite&&<form className="case-create" onSubmit={e=>{e.preventDefault();void create()}}>
   <strong>新建班级事件</strong>
   {sourceRecordId&&<div className="case-linked-source"><span><b>已选择原始{kind}记录</b> · 编号 {sourceRecordId.slice(0,8)}…，保存后将由数据库核对所属学生并防重复关联。</span><button className="record-refresh" type="button" disabled={Boolean(busyId)||uncertain} onClick={()=>{setSourceRecordId('');setRequestKey(newKey())}}>取消来源关联</button></div>}
   <div className="case-form-grid">
    <label>关联学生<select required disabled={Boolean(busyId)||uncertain||Boolean(sourceRecordId)} value={studentId} onChange={e=>setStudentId(e.target.value)}>
      <option value="">选择在读学生</option>{students.map(s=><option value={s.id} key={s.id}>{s.student_no} · {s.name}</option>)}
     </select></label>
    <label>事件类别<select disabled={Boolean(busyId)||uncertain||Boolean(sourceRecordId)} value={kind} onChange={e=>setKind(e.target.value)}>{CASE_KINDS.map(k=><option key={k}>{k}</option>)}</select></label>
    <label className="case-form-wide">事件标题<input required minLength={2} maxLength={80} disabled={Boolean(busyId)||uncertain} value={title} onChange={e=>setTitle(e.target.value)} placeholder="例如：课堂纪律需要跟进"/></label>
    <label className="case-form-wide">情况说明<textarea maxLength={1000} rows={2} disabled={Boolean(busyId)||uncertain} value={description} onChange={e=>setDescription(e.target.value)} placeholder="客观描述事实，暂不填写无关的家庭敏感信息"/></label>
   </div>
   <div className="case-create-actions"><button type="submit" className="button" disabled={Boolean(busyId)||uncertain||!studentId||title.trim().length<2}>{busyId==='create'?'正在创建…':'创建待分派工单'}</button>
    {uncertain&&<><button type="button" className="button secondary" disabled={Boolean(busyId)} onClick={()=>void verify()}>核对本次请求</button><button type="button" className="button secondary" disabled={Boolean(busyId)} onClick={()=>void create()}>按原编号重试</button></>}
   </div>
  </form>}
  {!canWrite&&<p className="notice">当前为只读模式；事件可查询，但不能创建、指派或结案。新建功能仅在独立环境验收后启用。</p>}
  <div className="record-toolbar"><label>工单状态 <select value={filter} onChange={e=>{setFilter(e.target.value);setCaseScope('')}}><option>全部</option>{CASE_STATES.map(v=><option key={v}>{v}</option>)}</select></label><button type="button" className="record-refresh" disabled={loading} onClick={()=>setRevision(v=>v+1)}>重新读取</button></div>
  {candidateError&&<p className="notice error" role="status">{candidateError}</p>}
  {error&&<p className="notice error" role="alert">{error}</p>}
  {notice&&<p className="notice success" role="status">{notice}</p>}
  <div className="case-list">{cases.map(row=>{
   const isOwner=owned;
   const canAssign=canWrite&&isOwner&&['待分派','处理中','待复核'].includes(row.status);
   const canReply=canWrite&&row.status==='处理中'&&row.assigned_to===userId;
   const canClose=canWrite&&isOwner&&row.status==='待复核';
   const canReopen=canWrite&&isOwner&&['待复核','已结案'].includes(row.status);
   return <article key={row.id} className="case-card">
    <div className="case-head"><span className="event-type">{row.kind}</span><strong>{row.title}</strong><span className="event-state">{row.status}</span></div>
    <div className="case-meta"><span>{names.get(row.student_id)??'学生（未关联当前在读名单）'}</span><span>负责人：{row.assigned_to?(actors.get(row.assigned_to)??'已绑定授权账号'):'待分派'}</span><span className={row.status!=='已结案'&&row.due_on&&row.due_on<today?'case-due-tag is-overdue':'case-due-tag'}>{row.due_on?'截止 '+row.due_on+(row.status!=='已结案'&&row.due_on<today?' · 已逾期':''):'尚未设置期限'}</span><time>{row.created_at?.slice(0,16).replace('T',' ')}</time></div>
    {row.description&&<p className="case-description">{row.description}</p>}
    <div className="case-options">{owned&&<button type="button" className="record-refresh" onClick={()=>onStudent(row.student_id)}>学生档案</button>}<button type="button" className="record-refresh" onClick={()=>void toggleHistory(row.id)}>{expandedId===row.id?'收起处理流水':'查看处理流水'}</button></div>
    {expandedId===row.id&&<div className="case-history"><strong>处理时间线</strong>{historyBusy?<p>正在读取…</p>:(history[row.id]??[]).map(h=><div key={h.id} className="case-history-item"><time>{h.created_at?.slice(0,16).replace('T',' ')}</time><b>{h.action}</b><span>{displayActor(h.actor_id)}</span>{(h.action==='指派'||h.action==='转派')&&<p className="case-transfer-detail">负责人：{displayActor(h.previous_assignee)} → {displayActor(h.next_assignee)}</p>}{['设置期限','调整期限','取消期限'].includes(h.action)&&<p className="case-transfer-detail">处理期限：{h.previous_due_on??'未设置'} → {h.next_due_on??'未设置'}</p>}<p>{h.note||h.to_status}</p></div>)}</div>}
    {canWrite&&owned&&row.status!=='已结案'&&<div className="case-deadline-controls">
     <label>处理截止日期<input type="date" value={deadlineDrafts[row.id]??row.due_on??''} disabled={Boolean(busyId)} onChange={e=>setDeadlineDrafts(p=>({...p,[row.id]:e.target.value}))}/></label>
     <label>期限调整说明<textarea rows={2} maxLength={500} value={deadlineNotes[row.id]??''} disabled={Boolean(busyId)} onChange={e=>setDeadlineNotes(p=>({...p,[row.id]:e.target.value}))} placeholder="例如：约定周五前完成家校回访；调整或取消也要说明原因"/></label>
     <button type="button" className="button secondary" disabled={Boolean(busyId)||(deadlineDrafts[row.id]??row.due_on??'')===(row.due_on??'')||(deadlineNotes[row.id]??'').trim().length<2} onClick={()=>void changeDeadline(row)}>{!row.due_on?'设置期限':(deadlineDrafts[row.id]??row.due_on)===''?'取消期限':'保存期限调整'}</button>
    </div>}
    {canWrite&&owned&&row.status==='处理中'&&row.assigned_to&&row.due_on&&row.due_on<=today&&<div className="case-nudge-controls">
     <div><strong>到期工单催办</strong><p className="muted">仅限今天到期或已逾期、已指派并仍在处理中的任务；每天最多催办一次。</p></div>
     <label>催办说明<textarea rows={2} maxLength={500} value={nudgeNotes[row.id]??''} disabled={Boolean(busyId)||Boolean(sentNudges[row.id])} onChange={e=>setNudgeNotes(p=>({...p,[row.id]:e.target.value}))} placeholder="例如：请在放学前核实该生请假情况，并提交处理反馈"/></label>
     <button type="button" className="button secondary" disabled={Boolean(busyId)||Boolean(sentNudges[row.id])||(nudgeNotes[row.id]??'').trim().length<2} onClick={()=>void sendReminder(row)}>{sentNudges[row.id]?'本页已催办':'催办负责人'}</button>
    </div>}
    {canAssign&&<div className="case-actions case-transfer-controls"><label>{row.assigned_to?'变更负责人':'指派负责人'}<select value={targetById[row.id]??row.assigned_to??''} onChange={e=>setTargetById(p=>({...p,[row.id]:e.target.value}))}><option value="">选择班主任或班干部</option>{candidates.map(c=><option key={c.user_id} value={c.user_id}>{c.student_id?names.get(c.student_id)??'未绑定学生':c.duty} · {c.duty}</option>)}</select></label>{row.assigned_to&&<label>转派原因（必填）<textarea rows={2} maxLength={1000} value={transferNotes[row.id]??''} onChange={e=>setTransferNotes(p=>({...p,[row.id]:e.target.value}))} placeholder="说明负责人变更原因，永久保留在工单流水"/></label>}<button type="button" className="button secondary" disabled={Boolean(busyId)||!(targetById[row.id]??row.assigned_to)||(targetById[row.id]??row.assigned_to)===row.assigned_to||(Boolean(row.assigned_to)&&!(transferNotes[row.id]??'').trim())} onClick={()=>void advance(row,'assign')}>{row.assigned_to?'确认转派':'确认指派'}</button></div>}
    {(canReply||canClose||canReopen)&&<div className="case-actions"><label>处理说明<textarea rows={2} maxLength={1000} value={notes[row.id]??''} onChange={e=>setNotes(p=>({...p,[row.id]:e.target.value}))} placeholder="写明处理情况、复核依据或退回原因"/></label><div className="case-action-buttons">
     {canReply&&<button type="button" className="button" disabled={Boolean(busyId)||!(notes[row.id]??'').trim()} onClick={()=>void advance(row,'reply')}>提交处理反馈</button>}
     {canClose&&<button type="button" className="button" disabled={Boolean(busyId)||!(notes[row.id]??'').trim()} onClick={()=>void advance(row,'close')}>复核通过并结案</button>}
     {canReopen&&<button type="button" className="button secondary" disabled={Boolean(busyId)||!(notes[row.id]??'').trim()} onClick={()=>void advance(row,'reopen')}>退回补充</button>}
    </div></div>}
   </article>
  })}</div>
  {!loading&&!error&&!cases.length&&<p className="preview-empty">当前没有可见工单，或筛选状态下暂无工单。</p>}
  <div className="record-pagination" aria-label="工单分页"><button type="button" disabled={loading||page<=1} onClick={()=>setPage(v=>v-1)}>上一页</button><span>第 {page} / {pages??'—'} 页</span><button type="button" disabled={loading||!cases.length||(pages!==null&&page>=pages)} onClick={()=>setPage(v=>v+1)}>下一页</button></div>
 </section>;
}
