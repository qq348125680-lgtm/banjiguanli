import {useState} from 'react';
import type {StudentItem} from '../lib/bridge';
import {nextOutstanding,outstandingStudents} from '../lib/entry-progress.mjs';
export function EntryProgress({roster,completed,selected,onSelect,loading}:{roster:StudentItem[];completed:string[];selected:string;onSelect:(id:string)=>void;loading:boolean}){
 const [onlyOutstanding,setOnlyOutstanding]=useState(false);
 const left=outstandingStudents(roster,completed);
 const visible=onlyOutstanding?left:roster;
 const next=nextOutstanding(roster,completed,selected);
 return <div className="entry-progress"><div className="entry-progress-head"><strong>连续登记助手</strong><span>{completed.length} 已提交 · {left.length} 本次尚未提交</span></div>
 <p>仅统计本次打开页面以来成功提交的待审核申请，<strong>不是实际出勤统计</strong>；刷新页面或切换日期会清零。</p>
 <div className="entry-progress-actions"><label className="entry-toggle"><input type="checkbox" checked={onlyOutstanding} onChange={e=>setOnlyOutstanding(e.target.checked)}/>只看本次未提交</label><button type="button" disabled={!next||loading} onClick={()=>onSelect(next)}>定位下一位尚未提交</button><button type="button" disabled={!left.length||loading} onClick={()=>onSelect(left[0].id)}>从未提交名单选择</button></div>
 <div className="entry-student-list" role="group" aria-label="本次登记学生列表">{visible.map(s=><button key={s.id} type="button" disabled={loading} className={`${s.id===selected?'chosen ':''}${completed.includes(s.id)?'submitted':''}`} onClick={()=>onSelect(s.id)}><span>{s.name}</span><small>{completed.includes(s.id)?'已提交待审':'待登记'}</small></button>)}</div>
 </div>
}
