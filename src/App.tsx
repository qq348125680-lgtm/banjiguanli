import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {LayoutDashboard,Users,ClipboardCheck,ClipboardList,ShieldCheck,Archive,LogOut,RefreshCw,Menu,X,BookOpen} from 'lucide-react';
import type {User} from '@supabase/supabase-js';
import {client,configured,writesEnabled} from './lib/client';
import {getBridges,type ClassItem,type DelegateItem,type Submission,type StudentItem,type AuditItem,type DossierPage} from './lib/bridge';
import {displayError,sanitizeList,dateToday,pendingLabel,canSubmitAsDelegate,canSubmitToRoster,canReviewSubmission,isValidDate,uncertainWriteOutcome} from './lib/domain.mjs';
import {Message,Button} from './components/Common';
import {StudentsPanel} from './components/StudentsPanel';
import {SafePreviewWorkspace} from './components/SafePreviewWorkspace';
import {StudentDossierPanel} from './components/StudentDossierPanel';
import {AuditPanel} from './components/AuditPanel';
import {ReportsPanel} from './components/ReportsPanel';
import {ClassRecordsPanel} from './components/ClassRecordsPanel';
import {PointRulesPanel} from './components/PointRulesPanel';
import {ClassOrganizationPanel} from './components/ClassOrganizationPanel';
import {AttendanceEntryPanel} from './components/AttendanceEntryPanel';
import {ReviewPanel} from './components/ReviewPanel';
import {markSubmissionConfirmed,nextOutstanding} from './lib/entry-progress.mjs';
import {loadScopedPanels} from './lib/scope-loader.mjs';
import {decideSnapshot,reconcileAuthorization,canReadAuthorizedScope,shouldRevalidateForeground} from './lib/snapshot-policy.mjs';
import {decideQuerySnapshot} from './lib/query-snapshot.mjs';
import {createAuthBootstrapGate} from './lib/auth-bootstrap.mjs';
import {invalidateSelectedClass} from './lib/authorization-race.mjs';
import {decideReadFailure} from './lib/read-failure-policy.mjs';
import {withReadDeadline} from './lib/read-deadline.mjs';
import {withUncertainWriteDeadline} from './lib/write-deadline.mjs';
import {browserSessionStorage,loadPendingMarker,savePendingMarker,clearPendingMarker} from './lib/pending-write-marker.mjs';

type View='dashboard'|'students'|'entry'|'review'|'records'|'reports'|'archive';
const nav:[View,string,typeof LayoutDashboard][]=[['dashboard','工作台',LayoutDashboard],['students','学生中心',Users],['entry','班级事务',ClipboardList],['review','审核中心',ClipboardCheck],['records','班务记录',BookOpen],['reports','数据分析',ShieldCheck],['archive','工作档案',Archive]];
const legacyNotice='Alpha 46：班干部提交和班主任审核增加超时后锁定与服务器结果核对；正式写入仍默认关闭，隔离数据库事务与权限尚未线上验收。';
export default function App(){
 const bridges=useMemo(()=>client?getBridges(client):null,[]);
 const [user,setUser]=useState<User|null>(null),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[authBusy,setAuthBusy]=useState(false);
 const [classes,setClasses]=useState<ClassItem[]>([]),[delegated,setDelegated]=useState<DelegateItem[]>([]),[classId,setClassId]=useState('');
 const [view,setView]=useState<View>('dashboard'),[mobile,setMobile]=useState(false),[loading,setLoading]=useState(false),[problem,setProblem]=useState('');
 const [previewLayout,setPreviewLayout]=useState(false);
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
 const [uncertainSubmit,setUncertainSubmit]=useState<{accountId:string;classId:string;day:string;studentId:string}|null>(null);
 const [uncertainReview,setUncertainReview]=useState<{accountId:string;classId:string;id:string}|null>(null);
 const [dossierId,setDossierId]=useState('');
 const [studentTab,setStudentTab]=useState<'roster'|'organization'>('roster');
 const [recordTab,setRecordTab]=useState<'activity'|'rules'>('activity');
 const [cadreDirectory,setCadreDirectory]=useState<{uid:string;name:string|null;duty:string;enabled:boolean}[]>([]);
 const [authorizationChecking,setAuthorizationChecking]=useState(false);
 const [authorizationBlocked,setAuthorizationBlocked]=useState(false);
 const authorizedClassIds=useMemo(()=>[...classes.map(c=>c.id),...delegated.map(d=>d.class_id)],[classes,delegated]);
 const isAuthorizedClass=Boolean(classId)&&authorizedClassIds.includes(classId);
 const owned=classes.some(c=>c.id===classId);
 useEffect(()=>{
  setDossierId('');setStudentTab('roster');setRecordTab('activity');setReviewNotes({});setBusyId('');setFeedback('');
  const id=user?.id&&classId?loadPendingMarker(browserSessionStorage(),'review',{accountId:user.id,classId}):null;
  setUncertainReview(id&&user?{accountId:user.id,classId,id}:null);
 },[classId,user?.id]);
 const fetchDossierPage=useCallback(async(section:'考勤'|'请假'|'违纪'|'积分'|'值日',targetPage:number,targetPageSize:number):Promise<DossierPage>=>{
  if(!bridges||!user||!classId||!owned||!isAuthorizedClass||authorizationBlocked||authorizationChecking||!dossierId)throw new Error('当前无权读取档案');
  return bridges.reader.dossierPageForOwner(classId,dossierId,section,{page:targetPage,pageSize:targetPageSize});
 },[bridges,user,classId,owned,isAuthorizedClass,authorizationBlocked,authorizationChecking,dossierId]);
 const fetchClassRecords=useCallback(async(kind:string,targetPage:number,targetPageSize:number,filters:{studentId?:string;startOn?:string;endOn?:string})=>{
  if(!bridges||!user||!classId||!owned||!isAuthorizedClass||authorizationBlocked||authorizationChecking)throw Error('当前无权读取班级业务记录');
  return bridges.reader.classRecordsForOwner(classId,kind,{page:targetPage,pageSize:targetPageSize,...filters});
 },[bridges,user,classId,owned,isAuthorizedClass,authorizationBlocked,authorizationChecking]);
 const fetchPointRules=useCallback(async()=>{
  if(!bridges||!user||!classId||!owned||!isAuthorizedClass||authorizationBlocked||authorizationChecking)throw Error('当前无权读取班级积分规则');
  return bridges.reader.pointRulesForOwner(classId);
 },[bridges,user,classId,owned,isAuthorizedClass,authorizationBlocked,authorizationChecking]);
 const fetchClassOrganization=useCallback(async()=>{
  if(!bridges||!user||!classId||!owned||!isAuthorizedClass||authorizationBlocked||authorizationChecking)throw Error('当前无权查看班级组织信息');
  return bridges.reader.classOrganizationForOwner(classId);
 },[bridges,user,classId,owned,isAuthorizedClass,authorizationBlocked,authorizationChecking]);
 // Resolve delegate UID to name ONLY inside a verified owner class. A lost permission
 // immediately clears the directory; slow prior requests cannot repopulate it.
 useEffect(()=>{
  setCadreDirectory([]);
  if(!bridges||!user||!classId||!owned||!isAuthorizedClass||authorizationBlocked||authorizationChecking||view!=='review')return;
  let active=true;
  withReadDeadline(()=>bridges.reader.cadreDirectoryForOwner(classId))
   .then(rows=>{if(active)setCadreDirectory(rows)})
   .catch(()=>{if(active)setCadreDirectory([])});
  return ()=>{active=false};
 },[bridges,user?.id,classId,owned,isAuthorizedClass,authorizationBlocked,authorizationChecking,view]);
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
 const loadClasses=useCallback(async()=>{if(!bridges||!user)return;const sequence=++authorizationSeq.current;setLoading(true);setProblem('');try{const data=await withReadDeadline(()=>bridges.reader.authorizedClasses());if(sequence!==authorizationSeq.current)return;setClasses(data.owned);setDelegated(data.delegated);setAuthorizationBlocked(false);setClassId(prev=>[...data.owned.map((x:ClassItem)=>x.id),...data.delegated.map((x:DelegateItem)=>x.class_id)].includes(prev)?prev:(data.owned[0]?.id??data.delegated[0]?.class_id??''));}catch(e){if(sequence===authorizationSeq.current){setAuthorizationBlocked(true);requestSeq.current++;loadedScopeRef.current='';setClasses([]);setDelegated([]);setClassId('');setStudents([]);setRoster([]);setRosterLoaded(false);setItems([]);setTotal(null);setAudits([]);setAuditTotal(null);setPendingCount(null);setDossierId('');setReviewNotes({});setSubmittedSession([]);setFeedback('');setProblem('读取班级授权失败，已清除先前显示的班级及业务数据，请重新验证：'+displayError(e));}}finally{if(sequence===authorizationSeq.current)setLoading(false)}},[bridges,user]);
 useEffect(()=>{
  const nextAccountId=user?.id??'';
  if(activeAccountId.current!==nextAccountId){
   // An auth boundary invalidates ALL previous data, even if an old request later resolves.
   activeAccountId.current=nextAccountId;
   foregroundCheckRef.current.lastCheck=0;
   requestSeq.current++;authorizationSeq.current++;loadedScopeRef.current='';
   setAuthorizationBlocked(false);setClasses([]);setDelegated([]);setClassId('');setStudents([]);setRoster([]);setRosterLoaded(false);
   setItems([]);setTotal(null);setAudits([]);setAuditTotal(null);setPendingCount(null);
   setDossierId('');setReviewNotes({});setSubmittedSession([]);setSelected('');setUncertainSubmit(null);setUncertainReview(null);
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
     const result=await withReadDeadline(()=>loadScopedPanels({owned,view,reader:bridges.reader,writer:bridges.writer,classId,page,pageSize,filter,sanitizeList}));
     if(sequence!==requestSeq.current)return;
     const recovery=decideReadFailure(result,{owned,view});
     if(recovery.blockClass){
       // RLS revocation or a failed roster refresh must unmount private child snapshots.
       loadedScopeRef.current='';setAuthorizationBlocked(true);
       setStudents([]);setRoster([]);setRosterLoaded(false);setItems([]);setTotal(null);
       setPendingCount(null);setAudits([]);setAuditTotal(null);setDossierId('');
       setSubmittedSession([]);setReviewNotes({});setSelected('');setFeedback('');
       setProblem('学生名单读取失败；已隐藏班级数据并暂停业务操作，请重新验证班级授权。');
       return;
     }
     if(result.roster.ok){setStudents(result.roster.value);setRoster(result.roster.value);setRosterLoaded(true)}
     if(recovery.clearReviews){setItems([]);setTotal(null)}
     else if(result.reviews.ok){setItems(result.reviews.value.items);setTotal(result.reviews.value.count)}
     if(recovery.clearPending)setPendingCount(null);
     else if(result.pending.ok)setPendingCount(result.pending.value);
     if(recovery.clearAudit){setAudits([]);setAuditTotal(null)}
     else if(result.audit.ok){setAudits(result.audit.value?.items??[]);setAuditTotal(result.audit.value?.count??null)}
     if(recovery.failedNames.length)setProblem(recovery.failedNames.join('、')+'读取失败；已清除失败模块的上次结果，请重新验证权限或稍后重试。');
   }catch(e){
     if(sequence===requestSeq.current){
       loadedScopeRef.current='';setAuthorizationBlocked(true);
       setStudents([]);setRoster([]);setRosterLoaded(false);setItems([]);setTotal(null);
       setPendingCount(null);setAudits([]);setAuditTotal(null);setDossierId('');
       setSubmittedSession([]);setReviewNotes({});setSelected('');setFeedback('');
       setProblem('数据读取异常，已清除旧班级信息并暂停操作，请重新验证授权：'+displayError(e));
     }
   }
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
   const data=await withReadDeadline(()=>bridges.reader.authorizedClasses());
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
 async function submit(){
  if(!bridges||!canSubmit||!canSubmitToRoster({roster,studentId:selected,classId,owned})||!isValidDate(day)||submittedSession.includes(selected)||operationLock.current)return;
  if(uncertainSubmit&&uncertainSubmit.accountId===user?.id&&uncertainSubmit.classId===classId&&uncertainSubmit.day===day&&uncertainSubmit.studentId===selected){
   setProblem('该学生本日有尚未核实的提交结果。请先点击「核对提交结果」，不要重复提交。');return;
  }
  operationLock.current=true;
  const operationScope=scopeRef.current, submittedStudent=selected, submittedDay=day, submittedClass=classId, submittedAccount=user!.id;
  setBusyId('submit');setProblem('');setFeedback('');
  try{
   await withUncertainWriteDeadline(()=>bridges.writer.submit({classId:submittedClass,studentId:submittedStudent,entryType:'考勤',date:submittedDay,status:attendance,note}));
   if(scopeRef.current===operationScope){
    clearPendingMarker(browserSessionStorage(),'submit',{accountId:submittedAccount,classId:submittedClass,day:submittedDay});
    setUncertainSubmit(null);setNote('');setPage(1);
    setSubmittedSession(prev=>markSubmissionConfirmed(prev,submittedStudent));
    setSelected(nextOutstanding(roster,[...submittedSession,submittedStudent],submittedStudent));
    await loadData();
    if(scopeRef.current===operationScope)setFeedback('申请已提交待审核，尚未计入正式考勤。');
   }
  }catch(e){
   if(scopeRef.current===operationScope){
    if(uncertainWriteOutcome(e)){
     savePendingMarker(browserSessionStorage(),'submit',{accountId:submittedAccount,classId:submittedClass,day:submittedDay},submittedStudent);
     setUncertainSubmit({accountId:submittedAccount,classId:submittedClass,day:submittedDay,studentId:submittedStudent});
     setProblem('提交结果暂时无法确认：服务器可能已保存申请。已锁定此学生本日重复提交，请先核对「我的提交记录」。');
    }else setProblem(displayError(e));
   }
  }finally{operationLock.current=false;setBusyId('')}
 }
 async function reconcileUncertainSubmission(){
  if(!uncertainSubmit||!bridges||!user||operationLock.current||authorizationBlocked||authorizationChecking)return;
  const pending=uncertainSubmit;
  if(pending.accountId!==user.id||pending.classId!==classId||pending.day!==day)return;
  operationLock.current=true;setBusyId('verify');setProblem('');setFeedback('');
  try{
   const records=await withReadDeadline(()=>bridges.writer.verifySubmission({classId:pending.classId,studentId:pending.studentId,date:pending.day}));
   if(scopeRef.current!==`${pending.accountId}:${pending.classId}:${pending.day}`)return;
   if(records.length){
    setSubmittedSession(prev=>markSubmissionConfirmed(prev,pending.studentId));
    clearPendingMarker(browserSessionStorage(),'submit',{accountId:pending.accountId,classId:pending.classId,day:pending.day});
    setUncertainSubmit(null);
    setFeedback('已在服务器查询到该学生本日的考勤申请；请到「我的提交记录」核对状态，不要再次提交。');
    await loadData();
   }else setProblem('未查到可见申请，但仍无法证明之前的写入未发生。为避免重复，当前页面继续锁定本次提交，请从旧版核实后再操作。');
  }catch(e){
   if(scopeRef.current===`${pending.accountId}:${pending.classId}:${pending.day}`)
    setProblem('核对失败，继续禁止重复提交。请检查网络或使用旧版核实：'+displayError(e));
  }finally{operationLock.current=false;setBusyId('')}
 }
 async function review(id:string,action:'approve'|'reject'){
  if(!bridges||!canWrite||!owned||!canReviewSubmission(items,id,action)||operationLock.current)return;
  if(uncertainReview?.id===id&&uncertainReview.accountId===user?.id&&uncertainReview.classId===classId){
   setProblem('该申请有尚未确认的审核结果，请先核对服务器状态，避免重复审核。');return;
  }
  operationLock.current=true;
  const account=user!.id, submittedClass=classId,operationScope=scopeRef.current;
  setBusyId(id);setProblem('');setFeedback('');
  try{
   await withUncertainWriteDeadline(()=>bridges.writer.review(id,action,reviewNotes[id]??''));
   if(scopeRef.current===operationScope){
    clearPendingMarker(browserSessionStorage(),'review',{accountId:account,classId:submittedClass});
    setUncertainReview(null);await loadData();
    if(scopeRef.current===operationScope)setFeedback(action==='approve'?'审核已通过，服务端事务已返回结果。':'已驳回，并保留审核原因。');
   }
  }catch(e){
   if(scopeRef.current===operationScope){
    if(uncertainWriteOutcome(e)){
     savePendingMarker(browserSessionStorage(),'review',{accountId:account,classId:submittedClass},id);
     setUncertainReview({accountId:account,classId:submittedClass,id});
     setProblem('审核结果未知：可能已经完成数据库事务。已锁定此申请的重复审批，请先核对服务器状态。');
    }else setProblem(displayError(e));
   }
  }finally{operationLock.current=false;setBusyId('')}
 }
 async function reconcileUncertainReview(){
  if(!bridges||!user||!uncertainReview||operationLock.current||authorizationBlocked||authorizationChecking)return;
  const pending=uncertainReview;
  if(pending.accountId!==user.id||pending.classId!==classId)return;
  operationLock.current=true;setBusyId('verify-review');setProblem('');setFeedback('');
  try{
   const record=await withReadDeadline(()=>bridges.writer.verifyReview({classId:pending.classId,submissionId:pending.id}));
   if(activeAccountId.current!==pending.accountId||classId!==pending.classId)return;
   if(record.status==='已通过'||record.status==='已驳回'){
    clearPendingMarker(browserSessionStorage(),'review',{accountId:pending.accountId,classId:pending.classId});
    setUncertainReview(null);
    await loadData();
    setFeedback('服务器已确认此申请状态：'+record.status+'。请核对实际记录，不要再次批准。');
   }else{
    setProblem('服务器目前仍显示待审核，可能存在未完成请求。为避免重复，暂不解锁此申请；请通过正式系统核实。');
   }
  }catch(e){
   if(activeAccountId.current===pending.accountId&&classId===pending.classId)setProblem('审核结果核对失败，继续锁定重复审批：'+displayError(e));
  }finally{operationLock.current=false;setBusyId('')}
 }
 const names=useMemo(()=>new Map(roster.map(s=>[s.id,s.name])),[roster]);

 // Page count is now owned by ReviewPanel.
 useEffect(()=>{
  setSubmittedSession([]);setSelected('');
  const studentId=user?.id&&classId&&isValidDate(day)?loadPendingMarker(browserSessionStorage(),'submit',{accountId:user.id,classId,day}):null;
  setUncertainSubmit(studentId&&user?{accountId:user.id,classId,day,studentId}:null);
 },[classId,day,user?.id]);
 function selectView(next:View){requestSeq.current++;setDossierId('');setView(next);setPage(1);setMobile(false);setFeedback('')}
 const accountSnapshotPending=activeAccountId.current!==(user?.id??'');
 if(accountSnapshotPending)return <div className="auth-shell"><section className="auth-card"><h1>正在切换登录身份</h1><p>旧账号数据已暂时隐藏，正在重新确认当前账号的班级授权。</p></section></div>;
 // During a permission revalidation, do not render an old class roster or audit snapshot.
 // Preserve the in-memory snapshot for success, but hide all sensitive UI until verified.
 if(user && classId && authorizationChecking)return <div className="auth-shell" role="status" aria-live="polite"><section className="auth-card"><div className="brand-icon">✦</div><h1>正在重新验证班级权限</h1><p>验证期间已临时隐藏学生名单、审核记录和操作日志。</p><p className="muted">确认授权后会自动恢复当前页面；如权限已失效，将清除旧数据并停止操作。</p></section></div>;
 // Fail closed: child panels contain their own scoped snapshots and must be unmounted
 // after revocation or a class mismatch; clearing only parent arrays is insufficient.
 if(user&&(authorizationBlocked||(classId&&!isAuthorizedClass)))return <div className="auth-shell" role="alert"><section className="auth-card"><div className="brand-icon">✦</div><h1>班级授权需要重新确认</h1><p>当前已隐藏所有学生、宿舍、值日、家校沟通、积分和审核页面，防止显示旧授权的数据。</p><p className="muted">复核失败不代表原有数据丢失。请检查网络或班级授权后重新验证。</p><Button secondary onClick={()=>void verifiedRefresh()}>重新验证授权</Button></section></div>;
 if(!configured)return previewLayout?<SafePreviewWorkspace onExit={()=>setPreviewLayout(false)}/>:<div className="auth-shell"><section className="auth-card"><div className="brand-icon">✦</div><h1>智慧班级工作台</h1><p>V7.0 Alpha 46 · 安全技术预览</p><Message kind="info" message={import.meta.env.PROD?"公网部署已成功。本页面是无数据库连接的安全技术预览：暂不能登录、读取学生信息或登记考勤。正式业务请继续使用原有系统。":"本地尚未配置 Supabase 公共连接参数。请根据 .env.example 创建 .env.local，填写公共 URL 和 publishable key；不得填写管理员密钥。"} /><button type="button" className="button full" onClick={()=>setPreviewLayout(true)}>查看各模块界面布局（无数据）</button><p className="muted">当前预览不连接真实数据库，不显示或伪造真实学生资料，亦不启用业务写入。</p></section></div>;
 if(!user)return <div className="auth-shell"><form className="auth-card" onSubmit={e=>{e.preventDefault();void login()}}><div className="brand-icon">✦</div><h1>智慧班级工作台</h1><p>欢迎回来 · 请使用现有 Supabase 账号</p><label>登录邮箱<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required/></label><label>密码<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/></label><button className="button full" disabled={authBusy}>{authBusy?'正在登录…':'登录工作台'}</button>{problem&&<Message kind="error" message={problem}/>}<p className="muted">无演示账号，无默认密码。所有数据遵循现有数据库授权。</p></form></div>;
 return <div className="shell"><aside className={`sidebar ${mobile?'shown':''}`}><div className="brand"><div className="brand-icon">✦</div><div><strong>智慧班务</strong><small>SMART CLASS · ALPHA 46</small></div><button className="icon-btn close-nav" onClick={()=>setMobile(false)} aria-label="关闭菜单"><X size={20}/></button></div><div className="section-label">工作导航</div><nav>{nav.map(([key,label,Icon])=><button key={key} className={`nav-link ${view===key?'active':''}`} onClick={()=>selectView(key)}><Icon size={19}/><span>{label}</span></button>)}</nav><div className="side-foot"><div className="sidebar-hint">新旧并行 · 正式业务仍保留旧版</div><button className="nav-link" onClick={()=>void logout()}><LogOut size={19}/>退出登录</button></div></aside>{mobile&&<button className="scrim" aria-label="关闭侧边栏" onClick={()=>setMobile(false)}/>}
 <div className="main"><header className="topbar"><button className="icon-btn hamburger" onClick={()=>setMobile(true)} aria-label="打开菜单"><Menu size={22}/></button><span>智慧班务 / <strong>{nav.find(x=>x[0]===view)?.[1]}</strong></span><div className="top-right"><span className="version">V7.0 · Alpha 46</span><button className="icon-btn" onClick={()=>void verifiedRefresh()} title="重新校验授权并刷新" aria-label="刷新数据"><RefreshCw size={18}/></button></div></header><main className="content"><div className="top-heading"><div><div className="eyebrow">CLASS WORKSPACE / 安全并行改造</div><h1>{nav.find(x=>x[0]===view)?.[1]}</h1><p>常用事项集中操作，数据按登录身份和班级权限展示。</p></div><label className="class-picker">当前班级<select value={classId} onChange={e=>{invalidateSelectedClass(authorizationSeq,requestSeq);setAuthorizationChecking(false);setLoading(false);setProblem('');loadedScopeRef.current='';setStudents([]);setRoster([]);setRosterLoaded(false);setItems([]);setTotal(null);setAudits([]);setAuditTotal(null);setPendingCount(null);setClassId(e.target.value);setPage(1);setSelected('');setSubmittedSession([])}}><option value="">请选择班级</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}{delegated.map(c=><option key={c.class_id} value={c.class_id}>授权班级 · {c.duty||c.class_id.slice(0,8)}</option>)}</select></label></div>
 <div className="notice">当前为 Alpha 46 开发版本。{writesEnabled?'写入开关已开启：仍需先完成隔离环境的权限与事务验收。':'默认只读：正式提交和审批已锁定。'} {legacyNotice}</div>
 {problem&&<Message kind="error" message={problem}/>}{feedback&&<Message kind="success" message={feedback}/>}{loading&&<div className="muted loading" role="status">正在读取数据…</div>}
 {!classId?<div className="panel"><h2>暂无可访问班级</h2><p className="muted">请确认班主任所有权或班干部授权状态；不要通过浏览器密钥绕过。</p><Button onClick={()=>void verifiedRefresh()} secondary>重新验证班级授权</Button></div>:<>
 {view==='dashboard'&&<><div className="stats"><div className="metric"><span>学生</span><b>{!rosterLoaded?'—':students.length}</b><small>当前授权班级 · 无法读取不显示为零</small></div><div className="metric"><span>待审核</span><b>{owned?pendingLabel(pendingCount):'—'}</b><small>全班精确计数；失败显示—</small></div><div className="metric"><span>账号身份</span><b className="metric-word">{owned?'班主任':'班干部'}</b><small>来自现有权限</small></div></div><section className="panel"><h2>常用操作</h2><div className="quick-grid"><Button onClick={()=>selectView('students')} secondary>学生查询</Button><Button onClick={()=>selectView('entry')} secondary>考勤提交</Button><Button onClick={()=>selectView('review')} secondary>审核记录</Button></div></section></>}
 {view==='students'&&<>
   {owned&&<div className="student-center-tabs" role="group" aria-label="学生中心子模块"><button type="button" aria-pressed={studentTab==='roster'} className={studentTab==='roster'?'active':''} onClick={()=>setStudentTab('roster')}>花名册与档案</button><button type="button" aria-pressed={studentTab==='organization'} className={studentTab==='organization'?'active':''} onClick={()=>setStudentTab('organization')}>座位 · 宿舍 · 班干部</button></div>}
   {(!owned||studentTab==='roster')&&<><StudentsPanel students={students} search={search} onSearch={setSearch} loading={loading} onSelect={owned?setDossierId:undefined} selectedId={dossierId}/>{owned&&dossierId&&<StudentDossierPanel student={students.find(st=>st.id===dossierId)} fetchPage={fetchDossierPage} onClose={()=>setDossierId('')}/>}</>}
   {owned&&studentTab==='organization'&&<ClassOrganizationPanel key={`${user.id}:${classId}`} load={fetchClassOrganization}/>}
  </>}
 {view==='entry'&&<AttendanceEntryPanel roster={roster} completed={submittedSession} uncertainStudentId={uncertainSubmit?.accountId===user.id&&uncertainSubmit?.classId===classId&&uncertainSubmit?.day===day?uncertainSubmit.studentId:null} verifyUncertain={()=>void reconcileUncertainSubmission()} selected={selected} setSelected={setSelected} loading={loading} busy={Boolean(busyId)} day={day} setDay={setDay} attendance={attendance} setAttendance={setAttendance} note={note} setNote={setNote} classId={classId} owned={owned} canSubmit={canSubmit} submit={()=>void submit()}/> }
 {view==='review'&&<ReviewPanel owned={owned} items={items} names={names} total={total} page={page} pageSize={pageSize} filter={filter} loading={loading} busy={Boolean(busyId)} cadreDirectory={cadreDirectory} uncertainReviewId={uncertainReview?.accountId===user.id&&uncertainReview?.classId===classId?uncertainReview.id:null} verifyReview={()=>void reconcileUncertainReview()} canWrite={canWrite} notes={reviewNotes} setNotes={setReviewNotes} setFilter={setFilter} setPage={setPage} setPageSize={setPageSize} review={(id,action)=>void review(id,action)}/> }
 {view==='records'&&(owned?<><div className="student-center-tabs" role="group" aria-label="班务记录子模块">
   <button type="button" className={recordTab==='activity'?'active':''} aria-pressed={recordTab==='activity'} onClick={()=>setRecordTab('activity')}>业务记录</button>
   <button type="button" className={recordTab==='rules'?'active':''} aria-pressed={recordTab==='rules'} onClick={()=>setRecordTab('rules')}>积分与违纪规则</button></div>
   {recordTab==='activity'&&<ClassRecordsPanel key={`${user.id}:${classId}`} load={fetchClassRecords}/>}
   {recordTab==='rules'&&<PointRulesPanel key={`${user.id}:${classId}`} load={fetchPointRules}/>}</>:<section className="panel placeholder"><h2>班务记录</h2><p>本入口仅班主任可以查看；班干部请使用授权的考勤提交和我的审核记录。</p></section>)}
  {view==='archive'&&owned&&<AuditPanel audits={audits} total={auditTotal} page={page} pageSize={pageSize} loading={loading} setPage={setPage} setPageSize={setPageSize}/>}
 {view==='reports'&&<ReportsPanel items={items} rosterCount={students.length} rosterLoaded={rosterLoaded} pendingCount={pendingCount} owned={owned} total={total} loading={loading} onReview={()=>selectView('review')}/>}
  {view==='archive'&&!owned&&<section className="panel placeholder"><div className="placeholder-icon">✧</div><h2>工作档案</h2><p>当前身份无法读取全班操作记录。正式归档功能仍使用旧版系统。</p><Button onClick={()=>selectView('dashboard')} secondary>返回工作台</Button></section>}
 </>}</main><nav className="bottom-nav">{nav.slice(0,4).map(([key,label,Icon])=><button key={key} className={view===key?'active':''} onClick={()=>selectView(key)}><Icon size={20}/><small>{label}</small></button>)}</nav></div></div>
}
