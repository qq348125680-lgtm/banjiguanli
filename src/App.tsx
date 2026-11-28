import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {LayoutDashboard,Users,ClipboardCheck,ClipboardList,ShieldCheck,Archive,LogOut,RefreshCw,Menu,X} from 'lucide-react';
import type {User} from '@supabase/supabase-js';
import {client,configured,writesEnabled} from './lib/client';
import {getBridges,type ClassItem,type DelegateItem,type Submission,type StudentItem,type AuditItem,type DossierPage} from './lib/bridge';
import {displayError,sanitizeList,dateToday,pendingLabel,canSubmitAsDelegate,canSubmitToRoster,canReviewSubmission,isValidDate} from './lib/domain.mjs';
import {Message,Button} from './components/Common';
import {StudentsPanel} from './components/StudentsPanel';
import {StudentDossierPanel} from './components/StudentDossierPanel';
import {AuditPanel} from './components/AuditPanel';
import {ReportsPanel} from './components/ReportsPanel';
import {AttendanceEntryPanel} from './components/AttendanceEntryPanel';
import {ReviewPanel} from './components/ReviewPanel';
import {markSubmissionConfirmed,nextOutstanding} from './lib/entry-progress.mjs';
import {loadScopedPanels} from './lib/scope-loader.mjs';
import {decideSnapshot,reconcileAuthorization,canReadAuthorizedScope,shouldRevalidateForeground} from './lib/snapshot-policy.mjs';
import {decideQuerySnapshot} from './lib/query-snapshot.mjs';
import {createAuthBootstrapGate} from './lib/auth-bootstrap.mjs';
import {invalidateSelectedClass} from './lib/authorization-race.mjs';

type View='dashboard'|'students'|'entry'|'review'|'reports'|'archive';
const nav:[View,string,typeof LayoutDashboard][]=[['dashboard','工作台',LayoutDashboard],['students','学生中心',Users],['entry','班级事务',ClipboardList],['review','审核中心',ClipboardCheck],['reports','数据分析',ShieldCheck],['archive','工作档案',Archive]];
const legacyNotice='本 Alpha 35 只提供安全只读及受控考勤提交/审核入口。请假、违纪、积分和值日仍需使用旧版正式系统。';
export default function App(){
 const bridges=useMemo(()=>client?getBridges(client):null,[]);
 const [user,setUser]=useState<User|null>(null),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[authBusy,setAuthBusy]=useState(false);
 const [classes,setClasses]=useState<ClassItem[]>([]),[delegated,setDelegated]=useState<DelegateItem[]>([]),[classId,setClassId]=useState('');
 const [view,setView]=useState<View>('dashboard'),[mobile,setMobile]=useState(false),[loading,setLoading]=useState(false),[problem,setProblem]=useState('');
 const [students,setStudents]=useState<StudentItem[]>([]),[roster,setRoster]=useState<StudentItem[]>([]),[rosterLoaded,setRosterLoaded]=useState(false),[items,setItems]=useState<Submission[]>([]),[total,setTotal]=useState<number|null>(null);
 const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(10),[filter,setFilter]=useState('全部'),[search,setSearch]=useState('');
 const [selected,setSelected]=useState(''),[submittedSession,setSubmittedSession]=useState<string[]>([]),[day,setDay]=useState(dateToday()),[attendance,setAttendance]=useState('出勤'),[note,setNote]=useState('');
 const [pendingCount,setPendingCount]=useState<number|null>(null),[audits,setAudits]=useState<AuditItem[]>([]),[auditTotal,setAuditTotal]=useState<number|null>(null),[feedback,setFeedback]=useState('');
 const requestSeq=useRef(0);
 const loadedScopeRef=useRef('');
 const reviewQueryRef=useRef('');
 const auditQueryRef=useRef('');
 const authorizationSeq=useRef(0);
 const activeAccountId=useRef('');
 const operationLock=useRef(false);
 // A foreground return must re-check a previously granted class. Avoid duplicate focus/visibility events.
 const foregroundCheckRef=useRef({lastCheck:0,inFlight:false});
 const latestRefreshRef=useRef<()=>Promise<void>>(async()=>{});
 const scopeRef=useRef('');scopeRef.current=`${user?.id??''}:${classId}:${day}`;
 const [reviewNotes,setReviewNotes]=useState<Record<string,string>>({}),[busyId,setBusyId]=useState('');
 const [dossierId,setDossierId]=useState('');
 const [authorizationChecking,setAuthorizationChecking]=useState(false);
 const [authorizationBlocked,setAuthorizationBlocked]=useState(false);
 const authorizedClassIds=useMemo(()=>[...classes.map(c=>c.id),...delegated.map(d=>d.class_id)],[classes,delegated]);
 const isAuthorizedClass=Boolean(classId)&&authorizedClassIds.includes(classId);
 const owned=classes.some(c=>c.id===classId);
 useEffect(()=>{setDossierId('');setReviewNotes({});setBusyId('');setFeedback('')},[classId,user?.id]);
 const fetchDossierPage=useCallback(async(section:'考勤'|'请假'|'违纪'|'积分'|'值日',targetPage:number,targetPageSize:number):Promise<DossierPage>=>{
  if(!bridges||!user||!classId||!owned||!isAuthorizedClass||authorizationBlocked||authorizationChecking||!dossierId)throw new Error('当前无权读取档案');
  return bridges.reader.dossierPageForOwner(classId,dossierId,section,{page:targetPage,pageSize:targetPageSize});
 },[bridges,user,classId,owned,isAuthorizedClass,authorizationBlocked,authorizationChecking,dossierId]);
 const canWrite=writesEnabled&&Boolean(bridges)&&Boolean(user)&&isAuthorizedClass&&!loading&&!authorizationChecking&&!authorizationBlocked;
 const canSubmit=canWrite&&canSubmitAsDelegate({owned,delegated,classId,writesEnabled});
 useEffect(()=>{
  if(!client)return;
  const gate=createAuthBootstrapGate();
  const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{
    if(!gate.isActive())return;
    gate.onAuthEvent();
    setUser(session?.user??null);
  });
  void client.auth.getUser().then(({data})=>{
    if(gate.canApplyBootstrap())setUser(data.user??null);
  }).catch(()=>{
    if(gate.canApplyBootstrap())setUser(null);
  });
  return ()=>{gate.dispose();subscription.unsubscribe()};
 },[]);
 const loadClasses=useCallback(async()=>{if(!bridges||!user)return;const sequence=++authorizationSeq.current;setLoading(true);setProblem('');try{const data=await bridges.reader.authorizedClasses();if(sequence!==authorizationSeq.current)return;setClasses(data.owned);setDelegated(data.delegated);setAuthorizationBlocked(false);setClassId(prev=>[...data.owned.map((x:ClassItem)=>x.id),...data.delegated.map((x:DelegateItem)=>x.class_id)].includes(prev)?prev:(data.owned[0]?.id??data.delegated[0]?.class_id??''));}catch(e){if(sequence===authorizationSeq.current){setAuthorizationBlocked(true);requestSeq.current++;loadedScopeRef.current='';setClasses([]);setDelegated([]);setClassId('');setStudents([]);setRoster([]);setRosterLoaded(false);setItems([]);setTotal(null);setAudits([]);setAuditTotal(null);setPendingCount(null);setDossierId('');setReviewNotes({});setSubmittedSession([]);setFeedback('');setProblem('读取班级授权失败，已清除先前显示的班级及业务数据，请重新验证：'+displayError(e));}}finally{if(sequence===authorizationSeq.current)setLoading(false)}},[bridges,user]);
 useEffect(()=>{
  const nextAccountId=user?.id??'';
  if(activeAccountId.current!==nextAccountId){
   // An auth boundary invalidates ALL previous data, even if an old request later resolves.
   activeAccountId.current=nextAccountId;
   foregroundCheckRef.current.lastCheck=0;
   requestSeq.current++;authorizationSeq.current++;loadedScopeRef.current='';
   setAuthorizationBlocked(false);setClasses([]);setDelegated([]);setClassId('');setStudents([]);setRoster([]);setRosterLoaded(false);
   setItems([]);setTotal(null);setAudits([]);setAuditTotal(null);setPendingCount(null);
   setDossierId('');setReviewNotes({});setSubmittedSession([]);setSelected('');
   setFeedback('');setProblem('');setPage(1);setLoading(false);
  }
  if(user){void loadClasses()}
 },[user?.id,loadClasses]);
 const loadData=useCallback(async(freshAuthorizedClassIds?:string[])=>{
   const verifiedOverride=Boolean(freshAuthorizedClassIds?.includes(classId));
   if(authorizationChecking&&!verifiedOverride)return;
   if(!user||!bridges)return;
   const sequence=++requestSeq.current;
   if(!canReadAuthorizedScope({hasBridge:Boolean(bridges),hasUser:Boolean(user),classId,authorizedClassIds:freshAuthorizedClassIds??authorizedClassIds,authorizationBlocked,verifiedOverride})){setStudents([]);setRoster([]);setRosterLoaded(false);setItems([]);setPendingCount(null);setAudits([]);setAuditTotal(null);setTotal(null);return;}
   setLoading(true);setProblem('');
   // A new page/filter must not display the previous page's rows or total, even if the query fails.
   const reviewSnapshot=decideQuerySnapshot(reviewQueryRef.current,[user.id,classId,owned?'owner':'delegate',page,pageSize,owned?filter:'全部']);
   const auditSnapshot=decideQuerySnapshot(auditQueryRef.current,[user.id,classId,view,page,pageSize]);
   reviewQueryRef.current=reviewSnapshot.key;
   auditQueryRef.current=auditSnapshot.key;
   if(reviewSnapshot.clear){setItems([]);setTotal(null);}
   if(auditSnapshot.clear){setAudits([]);setAuditTotal(null);}
   // Refresh within the same authorization scope preserves the last successful snapshot.
   // A different account/class must never inherit any previous snapshot.
   const snapshot=decideSnapshot(loadedScopeRef.current,user.id,classId);
   if(snapshot.clear){
     loadedScopeRef.current=snapshot.scope;
     setStudents([]);setRoster([]);setRosterLoaded(false);setItems([]);setAudits([]);setTotal(null);setAuditTotal(null);setPendingCount(null);
   }
   try {
     const result=await loadScopedPanels({owned,view,reader:bridges.reader,writer:bridges.writer,classId,page,pageSize,filter,sanitizeList});
     if(sequence!==requestSeq.current)return;
     if(result.roster.ok){setStudents(result.roster.value);setRoster(result.roster.value);setRosterLoaded(true)}
     if(result.reviews.ok){setItems(result.reviews.value.items);setTotal(result.reviews.value.count)}
     if(result.pending.ok)setPendingCount(result.pending.value);
     if(result.audit.ok){setAudits(result.audit.value?.items??[]);setAuditTotal(result.audit.value?.count??null)}
     const labels:{[key:string]:string}={roster:'学生名单',reviews:'审核记录',pending:'待审核数量',audit:'操作日志'};
     const errors=Object.entries(result as Record<string,{ok:boolean}>).filter(([key,item])=>!item.ok&&(key==='roster'||key==='reviews'||(key==='pending'&&owned)||(key==='audit'&&owned&&view==='archive')));
     if(errors.length)setProblem(errors.map(([key])=>`${labels[key]}读取失败`).join('、')+'；同查询条件刷新时保留上次成功记录（可能已过期），切换页码或筛选条件不沿用旧记录，请重试或到旧版核对。');
   }catch(e){if(sequence===requestSeq.current)setProblem(displayError(e));}
   finally{if(sequence===requestSeq.current)setLoading(false)}
 },[bridges,user,classId,owned,page,pageSize,filter,view,authorizationBlocked,authorizationChecking,authorizedClassIds]);
 useEffect(()=>{void loadData()},[loadData]);
 // A manual refresh must revalidate class authorization before reusing a cached roster.
 async function verifiedRefresh(){
  if(!bridges||!user)return;
  const requestedUser=user.id;
  const sequence=++authorizationSeq.current;
  ++requestSeq.current;
  setAuthorizationChecking(true);setProblem('');
  try{
   const data=await bridges.reader.authorizedClasses();
   if(sequence!==authorizationSeq.current||activeAccountId.current!==requestedUser)return;
   setAuthorizationBlocked(false);
   const decision=reconcileAuthorization(data,classId);
   setClasses(data.owned);setDelegated(data.delegated);
   if(!decision.authorized){
    // Never retain a revoked class's roster, audits or approval notes.
    loadedScopeRef.current='';setStudents([]);setRoster([]);setRosterLoaded(false);
    setItems([]);setTotal(null);setPendingCount(null);setAudits([]);setAuditTotal(null);
    setDossierId('');setReviewNotes({});setSubmittedSession([]);setSelected('');setFeedback('');
    setClassId(decision.nextClassId);setPage(1);
    // A first-time empty selection is not a revoked grant.
    // A previously selected class that disappeared remains blocked until verified again.
    const wasRevoked=Boolean(classId);
    setAuthorizationBlocked(wasRevoked);
    setProblem(wasRevoked?'班级授权已经变化，原有数据已清除；请重新验证新班级授权。':(decision.nextClassId?'已找到可访问的班级，正在读取其数据。':'当前账号没有可访问的班级。'));
   }else{
    await loadData([...data.owned.map((c:ClassItem)=>c.id),...data.delegated.map((d:DelegateItem)=>d.class_id)]);
   }
  }catch(e){
   if(sequence===authorizationSeq.current&&activeAccountId.current===requestedUser){
    // Failed authorization validation is not a successful permission check.
    setAuthorizationBlocked(true);
    // Treat an unverifiable grant as unavailable, not as a network-only stale snapshot.
    // The prior data may belong to a class whose grant was just revoked.
    loadedScopeRef.current='';
    ++requestSeq.current;
    setStudents([]);setRoster([]);setRosterLoaded(false);
    setItems([]);setTotal(null);setPendingCount(null);
    setAudits([]);setAuditTotal(null);
    setDossierId('');setReviewNotes({});setSubmittedSession([]);setSelected('');setFeedback('');
    setProblem('班级授权复核失败，已清除先前显示的学生及业务数据，并暂停写入。请检查网络后重新验证：'+displayError(e));
   }
  }finally{if(sequence===authorizationSeq.current)setAuthorizationChecking(false)}
 }
 // Keep the registered listener stable while always using the latest auth/refresh closure.
 latestRefreshRef.current=verifiedRefresh;
 useEffect(()=>{
   if(!user?.id)return;
   const onForeground=()=>{
     const now=Date.now();
     if(!shouldRevalidateForeground({visible:document.visibilityState==='visible',activeUserId:activeAccountId.current,renderedUserId:user.id,inFlight:foregroundCheckRef.current.inFlight,lastCheck:foregroundCheckRef.current.lastCheck,now}))return;
     foregroundCheckRef.current.lastCheck=now;
     foregroundCheckRef.current.inFlight=true;
     void latestRefreshRef.current().finally(()=>{foregroundCheckRef.current.inFlight=false});
   };
   window.addEventListener('focus',onForeground);
   document.addEventListener('visibilitychange',onForeground);
   return()=>{window.removeEventListener('focus',onForeground);document.removeEventListener('visibilitychange',onForeground)};
 },[user?.id]);
 async function login(){if(!client)return;setAuthBusy(true);setProblem('');try{const {error}=await client.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;setPassword('')}catch(e){setProblem(displayError(e))}finally{setAuthBusy(false)}}
 async function logout(){await client?.auth.signOut()}
 async function submit(){if(!bridges||!canSubmit||!canSubmitToRoster({roster,studentId:selected,classId,owned})||!isValidDate(day)||submittedSession.includes(selected)||operationLock.current)return;operationLock.current=true;const operationScope=scopeRef.current;setBusyId('submit');setProblem('');setFeedback('');try{await bridges.writer.submit({classId,studentId:selected,entryType:'考勤',date:day,status:attendance,note});if(scopeRef.current===operationScope){setNote('');setPage(1);setSubmittedSession(prev=>markSubmissionConfirmed(prev,selected));setSelected(nextOutstanding(roster,[...submittedSession,selected],selected));await loadData();if(scopeRef.current===operationScope)setFeedback('本次申请已提交待审核，尚未计入正式考勤。')}}catch(e){if(scopeRef.current===operationScope)setProblem(displayError(e))}finally{operationLock.current=false;setBusyId('')}}
 async function review(id:string,action:'approve'|'reject'){if(!bridges||!canWrite||!owned||!canReviewSubmission(items,id,action)||operationLock.current)return;operationLock.current=true;const operationScope=scopeRef.current;setBusyId(id);setProblem('');setFeedback('');try{await bridges.writer.review(id,action,reviewNotes[id]??'');if(scopeRef.current===operationScope){await loadData();if(scopeRef.current===operationScope)setFeedback(action==='approve'?'审核已通过，服务端事务已返回结果。':'已驳回，并保留审核原因。')}}catch(e){if(scopeRef.current===operationScope)setProblem(displayError(e))}finally{operationLock.current=false;setBusyId('')}}
 const names=useMemo(()=>new Map(roster.map(s=>[s.id,s.name])),[roster]);

 // Page count is now owned by ReviewPanel.
 useEffect(()=>{setSubmittedSession([]);setSelected('')},[classId,day,user?.id]);
 function selectView(next:View){requestSeq.current++;setDossierId('');setView(next);setPage(1);setMobile(false);setFeedback('')}
 const accountSnapshotPending=activeAccountId.current!==(user?.id??'');
 if(accountSnapshotPending)return <div className="auth-shell"><section className="auth-card"><h1>正在切换登录身份</h1><p>旧账号数据已暂时隐藏，正在重新确认当前账号的班级授权。</p></section></div>;
 // During a permission revalidation, do not render an old class roster or audit snapshot.
 // Preserve the in-memory snapshot for success, but hide all sensitive UI until verified.
 if(user && classId && authorizationChecking)return <div className="auth-shell" role="status" aria-live="polite"><section className="auth-card"><div className="brand-icon">✦</div><h1>正在重新验证班级权限</h1><p>验证期间已临时隐藏学生名单、审核记录和操作日志。</p><p className="muted">确认授权后会自动恢复当前页面；如权限已失效，将清除旧数据并停止操作。</p></section></div>;
 if(!configured)return <div className="auth-shell"><section className="auth-card"><div className="brand-icon">✦</div><h1>智慧班级工作台</h1><p>V7.0 Alpha 38 · 安全技术预览</p><Message kind="info" message={import.meta.env.PROD?"公网部署已成功。本页面是无数据库连接的安全技术预览：暂不能登录、读取学生信息或登记考勤。正式业务请继续使用原有系统。":"本地尚未配置 Supabase 公共连接参数。请根据 .env.example 创建 .env.local，填写公共 URL 和 publishable key；不得填写管理员密钥。"} /><p className="muted">当前预览不连接真实数据库，不显示或伪造学生资料，亦不启用业务写入。</p></section></div>;
 if(!user)return <div className="auth-shell"><form className="auth-card" onSubmit={e=>{e.preventDefault();void login()}}><div className="brand-icon">✦</div><h1>智慧班级工作台</h1><p>欢迎回来 · 请使用现有 Supabase 账号</p><label>登录邮箱<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required/></label><label>密码<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/></label><button className="button full" disabled={authBusy}>{authBusy?'正在登录…':'登录工作台'}</button>{problem&&<Message kind="error" message={problem}/>}<p className="muted">无演示账号，无默认密码。所有数据遵循现有数据库授权。</p></form></div>;
 return <div className="shell"><aside className={`sidebar ${mobile?'shown':''}`}><div className="brand"><div className="brand-icon">✦</div><div><strong>智慧班务</strong><small>SMART CLASS · ALPHA 39</small></div><button className="icon-btn close-nav" onClick={()=>setMobile(false)} aria-label="关闭菜单"><X size={20}/></button></div><div className="section-label">工作导航</div><nav>{nav.map(([key,label,Icon])=><button key={key} className={`nav-link ${view===key?'active':''}`} onClick={()=>selectView(key)}><Icon size={19}/><span>{label}</span></button>)}</nav><div className="side-foot"><div className="sidebar-hint">新旧并行 · 正式业务仍保留旧版</div><button className="nav-link" onClick={()=>void logout()}><LogOut size={19}/>退出登录</button></div></aside>{mobile&&<button className="scrim" aria-label="关闭侧边栏" onClick={()=>setMobile(false)}/>}
 <div className="main"><header className="topbar"><button className="icon-btn hamburger" onClick={()=>setMobile(true)} aria-label="打开菜单"><Menu size={22}/></button><span>智慧班务 / <strong>{nav.find(x=>x[0]===view)?.[1]}</strong></span><div className="top-right"><span className="version">V7.0 · Alpha 39</span><button className="icon-btn" onClick={()=>void verifiedRefresh()} title="重新校验授权并刷新" aria-label="刷新数据"><RefreshCw size={18}/></button></div></header><main className="content"><div className="top-heading"><div><div className="eyebrow">CLASS WORKSPACE / 安全并行改造</div><h1>{nav.find(x=>x[0]===view)?.[1]}</h1><p>常用事项集中操作，数据按登录身份和班级权限展示。</p></div><label className="class-picker">当前班级<select value={classId} onChange={e=>{invalidateSelectedClass(authorizationSeq,requestSeq);setAuthorizationChecking(false);setLoading(false);setProblem('');loadedScopeRef.current='';setStudents([]);setRoster([]);setRosterLoaded(false);setItems([]);setTotal(null);setAudits([]);setAuditTotal(null);setPendingCount(null);setClassId(e.target.value);setPage(1);setSelected('');setSubmittedSession([])}}><option value="">请选择班级</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}{delegated.map(c=><option key={c.class_id} value={c.class_id}>授权班级 · {c.duty||c.class_id.slice(0,8)}</option>)}</select></label></div>
 <div className="notice">当前为 Alpha 39 开发版本。{writesEnabled?'写入开关已开启：仍需先完成隔离环境的权限与事务验收。':'默认只读：正式提交和审批已锁定。'} {legacyNotice}</div>
 {problem&&<Message kind="error" message={problem}/>}{feedback&&<Message kind="success" message={feedback}/>}{loading&&<div className="muted loading" role="status">正在读取数据…</div>}
 {!classId?<div className="panel"><h2>暂无可访问班级</h2><p className="muted">请确认班主任所有权或班干部授权状态；不要通过浏览器密钥绕过。</p><Button onClick={()=>void verifiedRefresh()} secondary>重新验证班级授权</Button></div>:<>
 {view==='dashboard'&&<><div className="stats"><div className="metric"><span>学生</span><b>{!rosterLoaded?'—':students.length}</b><small>当前授权班级 · 无法读取不显示为零</small></div><div className="metric"><span>待审核</span><b>{owned?pendingLabel(pendingCount):'—'}</b><small>全班精确计数；失败显示—</small></div><div className="metric"><span>账号身份</span><b className="metric-word">{owned?'班主任':'班干部'}</b><small>来自现有权限</small></div></div><section className="panel"><h2>常用操作</h2><div className="quick-grid"><Button onClick={()=>selectView('students')} secondary>学生查询</Button><Button onClick={()=>selectView('entry')} secondary>考勤提交</Button><Button onClick={()=>selectView('review')} secondary>审核记录</Button></div></section></>}
 {view==='students'&&<><StudentsPanel students={students} search={search} onSearch={setSearch} loading={loading} onSelect={owned?setDossierId:undefined} selectedId={dossierId}/>{owned&&dossierId&&<StudentDossierPanel student={students.find(st=>st.id===dossierId)} fetchPage={fetchDossierPage} onClose={()=>setDossierId('')}/>}</>}
 {view==='entry'&&<AttendanceEntryPanel roster={roster} completed={submittedSession} selected={selected} setSelected={setSelected} loading={loading} busy={Boolean(busyId)} day={day} setDay={setDay} attendance={attendance} setAttendance={setAttendance} note={note} setNote={setNote} classId={classId} owned={owned} canSubmit={canSubmit} submit={()=>void submit()}/> }
 {view==='review'&&<ReviewPanel owned={owned} items={items} names={names} total={total} page={page} pageSize={pageSize} filter={filter} loading={loading} busy={Boolean(busyId)} canWrite={canWrite} notes={reviewNotes} setNotes={setReviewNotes} setFilter={setFilter} setPage={setPage} setPageSize={setPageSize} review={(id,action)=>void review(id,action)}/> }
 {view==='archive'&&owned&&<AuditPanel audits={audits} total={auditTotal} page={page} pageSize={pageSize} loading={loading} setPage={setPage} setPageSize={setPageSize}/>}
 {view==='reports'&&<ReportsPanel items={items} rosterCount={students.length} rosterLoaded={rosterLoaded} pendingCount={pendingCount} owned={owned} total={total} loading={loading} onReview={()=>selectView('review')}/>}
  {view==='archive'&&!owned&&<section className="panel placeholder"><div className="placeholder-icon">✧</div><h2>工作档案</h2><p>当前身份无法读取全班操作记录。正式归档功能仍使用旧版系统。</p><Button onClick={()=>selectView('dashboard')} secondary>返回工作台</Button></section>}
 </>}</main><nav className="bottom-nav">{nav.slice(0,4).map(([key,label,Icon])=><button key={key} className={view===key?'active':''} onClick={()=>selectView(key)}><Icon size={20}/><small>{label}</small></button>)}</nav></div></div>
}
