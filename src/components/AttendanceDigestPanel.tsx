import {useEffect,useState} from 'react';
import type {StudentItem} from '../lib/bridge';
import {attendanceDigest,weekStartMonday} from '../lib/attendance-digest.mjs';
export function AttendanceDigestPanel({records,students}:{records:Record<string,unknown>[];students:StudentItem[]}){
 const rows=records.map(r=>({student_id:String(r.student_id??''),on_date:String(r.on_date??''),status:String(r.status??'')}));
 const weeks=[...new Set(rows.filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.on_date)).map(r=>{try{return weekStartMonday(r.on_date)}catch{return ''}}).filter(Boolean))].sort().reverse();
 const [week,setWeek]=useState('');
 useEffect(()=>setWeek(''),[records]);
 const digest=week?attendanceDigest(rows,students,week):null;
 return <div className="attendance-digest" aria-label="考勤周统计参考">
  <h3>一周考勤核对</h3>
  <p className="muted">仅分析本页已经加载的记录，<strong>不代表全周完整数据</strong>。迟到两次折算一次旷课仅作为人工核对参考，不自动改写任何正式状态。</p>
  <label>选择周次 <select aria-label="考勤统计周一" value={week} onChange={e=>setWeek(e.target.value)}><option value="">选择本页包含的周次</option>{weeks.map(w=><option key={w} value={w}>{w} 开始的一周</option>)}</select></label>
  {digest&&<><div className="digest-summary"><span>本页该周可见记录 <strong>{digest.visibleRows}</strong></span><span>迟到记录 <strong>{digest.totalLate}</strong></span><span>缺勤记录 <strong>{digest.totalAbsent}</strong></span><span>迟到折算参考 <strong>{digest.lateEquivalent}</strong></span></div>
  <div className="digest-students">{digest.students.map(row=><article key={row.id}><strong>{row.name}</strong><span>迟到 {row.late} · 缺勤 {row.absent} · 请假 {row.leave}</span><span>迟到折算参考 {row.lateEquivalent}</span></article>)}</div>
  {!digest.students.length&&<p className="muted">该周在当前页面没有可见记录。</p>}</>}
  <p className="muted">如本周记录跨越多个分页，先通过日期筛选查看，再在旧版系统进行完整周汇总与实际考勤确认。</p>
 </div>;
}
