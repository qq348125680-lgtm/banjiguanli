import type {StudentItem} from '../lib/bridge';
import {attendanceStatuses,canSubmitToRoster,isValidDate} from '../lib/domain.mjs';
import {Button} from './Common';
import {EntryProgress} from './EntryProgress';
export type AttendanceEntryProps={roster:StudentItem[];completed:string[];selected:string;setSelected:(s:string)=>void;loading:boolean;busy:boolean;day:string;setDay:(s:string)=>void;attendance:string;setAttendance:(s:string)=>void;note:string;setNote:(s:string)=>void;classId:string;owned:boolean;canSubmit:boolean;submit:()=>void};
export function AttendanceEntryPanel(p:AttendanceEntryProps){
 const ready=p.canSubmit&&canSubmitToRoster({roster:p.roster,studentId:p.selected,classId:p.classId,owned:p.owned})&&isValidDate(p.day)&&!p.completed.includes(p.selected)&&!p.busy;
 return <section className="panel"><h2>班干部快捷考勤</h2><p className="muted">登记后进入待审核，不立即覆盖正式考勤。下方“已提交”仅代表本次打开页面期间成功提交的申请。</p>
 <EntryProgress roster={p.roster} completed={p.completed} selected={p.selected} onSelect={p.setSelected} loading={p.loading||p.busy}/>
 <div className="fields"><label>选择学生<select disabled={p.busy||p.loading} value={p.selected} onChange={e=>p.setSelected(e.target.value)}><option value="">请选择学生</option>{p.roster.map(st=><option key={st.id} value={st.id}>{st.student_no} · {st.name}</option>)}</select></label>
 <label>日期<input type="date" disabled={p.busy} value={p.day} onChange={e=>p.setDay(e.target.value)}/></label>
 <label>考勤状态<select disabled={p.busy} value={p.attendance} onChange={e=>p.setAttendance(e.target.value)}>{attendanceStatuses.map((v:string)=><option key={v}>{v}</option>)}</select></label>
 <label className="wide">情况备注<textarea disabled={p.busy} value={p.note} maxLength={500} onChange={e=>p.setNote(e.target.value)} placeholder="填写实际情况（可选）"/></label></div>
 <div className="form-actions"><Button disabled={!ready} onClick={p.submit}>{p.busy?'提交中…':'提交待审核'}</Button>{!p.canSubmit&&<span className="muted">仅授权班干部可提交。正式写入默认关闭，需完成数据库事务验收后启用。</span>}</div></section>;
}
