import type {StudentItem} from '../lib/bridge';
import {attendanceStatuses,canSubmitToRoster,isValidDate} from '../lib/domain.mjs';
import {Button} from './Common';
import {EntryProgress} from './EntryProgress';
export type AttendanceEntryProps={roster:StudentItem[];completed:string[];uncertainStudentId:string|null;verifyUncertain:()=>void;selected:string;setSelected:(s:string)=>void;loading:boolean;busy:boolean;day:string;setDay:(s:string)=>void;attendance:string;setAttendance:(s:string)=>void;note:string;setNote:(s:string)=>void;classId:string;owned:boolean;canSubmit:boolean;submit:()=>void};
export function AttendanceEntryPanel(p:AttendanceEntryProps){
 const ready=p.canSubmit&&canSubmitToRoster({roster:p.roster,studentId:p.selected,classId:p.classId,owned:p.owned})&&isValidDate(p.day)&&!p.completed.includes(p.selected)&&p.uncertainStudentId!==p.selected&&!p.busy;
 // Never carry another student's free-text note or exceptional attendance
 // status into the next student's application.
 const selectStudent=(id:string)=>{
  if(id!==p.selected){p.setNote('');p.setAttendance('出勤')}
  p.setSelected(id);
 };
 return <section className="panel"><h2>班干部快捷考勤</h2><p className="muted">登记后进入待审核，不立即覆盖正式考勤。下方“已提交”仅代表本次打开页面期间成功提交的申请。</p>
 <EntryProgress roster={p.roster} completed={p.completed} selected={p.selected} onSelect={selectStudent} loading={p.loading||p.busy}/>
 {p.uncertainStudentId&&<div role="alert" className="notice"><strong>存在尚未确认的提交结果</strong><p>当前账号本班级本日的该学生考勤可能已经被服务器保存。核实前暂停本班本日其他考勤提交，避免未确认记录互相覆盖。请先查询服务器实际申请，再判断下一步。</p><button type="button" className="record-refresh" disabled={p.busy||p.loading} onClick={p.verifyUncertain}>{p.busy?'核对中…':'核对提交结果'}</button></div>}
 <div className="fields"><label>选择学生<select disabled={p.busy||p.loading} value={p.selected} onChange={e=>selectStudent(e.target.value)}><option value="">请选择学生</option>{p.roster.map(st=><option key={st.id} value={st.id}>{st.student_no} · {st.name}</option>)}</select></label>
 <label>日期<input type="date" disabled={p.busy} value={p.day} onChange={e=>p.setDay(e.target.value)}/></label>
 <label className="attendance-status-desktop">考勤状态<select disabled={p.busy||p.loading} value={p.attendance} onChange={e=>p.setAttendance(e.target.value)}>{attendanceStatuses.map((v:string)=><option key={v}>{v}</option>)}</select></label>
 <label className="wide">情况备注<textarea disabled={p.busy||p.loading} value={p.note} maxLength={500} onChange={e=>p.setNote(e.target.value)} placeholder="填写实际情况（可选）"/></label></div>
 <div className="attendance-mobile-status" role="group" aria-label="快捷选择考勤状态">
  {attendanceStatuses.map((status:string)=><button key={status} type="button" disabled={p.busy||p.loading}
   aria-pressed={p.attendance===status} className={p.attendance===status?'active':''}
   onClick={()=>p.setAttendance(status)}>{status}</button>)}
 </div>
 <div className="form-actions"><Button disabled={!ready} onClick={p.submit}>{p.busy?'提交中…':'提交待审核'}</Button>{!p.canSubmit&&<span className="muted">仅授权班干部可提交。正式写入默认关闭，需完成数据库事务验收后启用。</span>}</div></section>;
}
