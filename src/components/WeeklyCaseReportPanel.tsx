import {useEffect,useMemo,useRef,useState} from 'react';
import {withReadDeadline} from '../lib/read-deadline.mjs';
import {CASE_KINDS} from '../lib/event-case-api.mjs';
import {addSchoolDays} from '../lib/case-deadline-model.mjs';
import {weekMonday,weeklyDates,verifyWeeklyRows,buildWeeklyReportText,WEEKLY_ACTIONS} from '../lib/class-weekly-case-report.mjs';

type WeeklyStats=ReturnType<typeof verifyWeeklyRows>;
type Props={load:(monday:string)=>Promise<{metric:string;item:string;amount:number|string}[]>;className:string};
export function WeeklyCaseReportPanel({load,className}:Props){
 const [monday,setMonday]=useState(()=>weekMonday());
 const [stats,setStats]=useState<WeeklyStats|null>(null),[busy,setBusy]=useState(true);
 const [error,setError]=useState(''),[copyStatus,setCopyStatus]=useState('');
 const [revision,setRevision]=useState(0),seq=useRef(0);
 const dates=useMemo(()=>weeklyDates(monday),[monday]);
 useEffect(()=>{
  const current=++seq.current;
  setStats(null);setError('');setCopyStatus('');setBusy(true);
  withReadDeadline(()=>load(monday)).then(rows=>{
   const data=verifyWeeklyRows(rows);
   if(current===seq.current)setStats(data);
  }).catch(()=>{
   if(current===seq.current)setError('本周工单统计未完整读取，暂不生成周报，以免误报为0。');
  }).finally(()=>{if(current===seq.current)setBusy(false)});
  return ()=>{seq.current++};
 },[load,monday,revision]);
 const report=useMemo(()=>stats?buildWeeklyReportText(className,monday,stats):'',[stats,className,monday]);
 const copyReport=async()=>{
  if(!stats)return;
  try{
   if(!navigator.clipboard?.writeText)throw Error('浏览器不支持一键复制');
   await navigator.clipboard.writeText(report);
   setCopyStatus('周报文字已复制，可以粘贴到 Word 或工作群草稿中。');
  }catch{setCopyStatus('自动复制不可用，请选择下方周报文字手动复制。')}
 };
 const saveTxt=()=>{
  if(!stats)return;
  const blob=new Blob(['\uFEFF'+report],{type:'text/plain;charset=utf-8'});
  const href=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=href;
  a.download='班级事件跟进周报_'+monday+'.txt';a.click();
  URL.revokeObjectURL(href);
 };
 const metric=(title:string,count:number,unit:string)=>(
  <div className="weekly-metric" key={title}><strong>{count}</strong><span>{title}</span><small>{unit}</small></div>
 );
 return <section className="panel weekly-case-report" aria-label="班主任事件跟进周报">
  <div className="panel-head"><div><h2>班级事件跟进周报</h2><p>从工单处理流水自动汇总 · 不重复登记 · 不包含学生或家长隐私</p></div>
   <button type="button" className="record-refresh" disabled={busy} onClick={()=>setRevision(v=>v+1)}>刷新周报</button></div>
  <div className="weekly-date-toolbar">
   <button type="button" className="record-refresh" onClick={()=>setMonday(x=>addSchoolDays(x,-7))}>上一周</button>
   <label>统计周一 <input type="date" value={monday} max={weekMonday()} onChange={e=>{if(e.target.value)setMonday(weekMonday(e.target.value))}}/></label>
   <button type="button" className="record-refresh" disabled={monday>=weekMonday()} onClick={()=>setMonday(x=>addSchoolDays(x,7))}>下一周</button>
   <span>{dates.start} — {dates.end}</span>
  </div>
  {busy&&<p role="status" className="muted">正在汇总本周真实工单和处理流水…</p>}
  {error&&<p role="alert" className="notice error">{error}</p>}
  {stats&&<>
   <div className="weekly-metrics">
    {metric('本周新建工单',stats.createdTotal,'件')}
    {metric('本周结案操作',stats.closedTotal,'次')}
    {metric('处理反馈',stats.reviewCount,'次')}
    {metric('本周催办',stats.nudgeCount,'次')}
    {metric('家校跟进新建',stats.familyCreated,'件')}
   </div>
   <div className="weekly-summary-grid">
    <div><h3>本周新建工单类别</h3><div className="weekly-report-list">{CASE_KINDS.map(kind=><div key={kind}><span>{kind}</span><strong>{stats.created[kind]}</strong></div>)}</div></div>
    <div><h3>重要流程次数</h3><div className="weekly-report-list">{WEEKLY_ACTIONS.filter(k=>!['创建','结案'].includes(k)).map(k=><div key={k}><span>{k}</span><strong>{stats.actions[k]}</strong></div>)}</div></div>
   </div>
   <p className="muted">新建统计的是本周创建的工单；结案、反馈等统计的是本周发生的操作次数。两者不能直接相除作为完成率，避免重复结案导致误判。</p>
   <div className="weekly-export-actions">
    <button type="button" className="button secondary" onClick={()=>void copyReport()}>复制周报正文</button>
    <button type="button" className="button secondary" onClick={saveTxt}>下载周报 TXT</button>
   </div>
   {copyStatus&&<p role="status" className="muted">{copyStatus}</p>}
   <label className="weekly-report-text-label">周报文字（可直接复制到 Word 编辑）
    <textarea className="weekly-report-text" rows={15} readOnly value={report} onFocus={e=>e.currentTarget.select()}/>
   </label>
   <p className="muted">这是可核查的事件工单工作汇总，并非全班原始考勤、违纪、请假及家访的完整学期统计。正式上报前请按学校要求补充其他台账。</p>
  </>}
 </section>;
}
