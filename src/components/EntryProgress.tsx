import {useState} from 'react';
import type {StudentItem} from '../lib/bridge';
import {nextOutstanding} from '../lib/entry-progress.mjs';
import {progressStudents} from '../lib/list-view.mjs';
export function EntryProgress({roster,completed,selected,onSelect,loading}:{roster:StudentItem[];completed:string[];selected:string;onSelect:(id:string)=>void;loading:boolean}){
 const [onlyOutstanding,setOnlyOutstanding]=useState(false);
 const [search,setSearch]=useState('');
 const {remaining,visible,done,total}=progressStudents(roster,completed,search,onlyOutstanding);
 const doneIds=new Set(completed);
 const next=nextOutstanding(roster,completed,selected);
 return <div className="entry-progress"><div className="entry-progress-head"><strong>连续登记助手</strong><span aria-live="polite">{done} / {total} 本次已提交 · {remaining.length} 尚未提交</span></div>
 <p>这里只统计本次页面成功提交的申请，<strong>不是实际出勤统计</strong>；刷新页面或切换日期会清零。</p>
 <div className="entry-progress-actions"><label className="entry-toggle"><input type="checkbox" checked={onlyOutstanding} onChange={e=>setOnlyOutstanding(e.target.checked)}/>只看本次未提交</label><button type="button" disabled={!next||loading} onClick={()=>onSelect(next)}>定位下一位尚未提交</button><button type="button" disabled={!remaining.length||loading} onClick={()=>onSelect(remaining[0].id)}>从未提交名单选择</button></div>
 <label className="entry-search-label">快速查找学生<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="输入姓名或学号" aria-label="筛选考勤学生"/></label>
 <div className="entry-student-list" role="group" aria-label="本次登记学生列表">{visible.map(s=><button key={s.id} type="button" disabled={loading} aria-pressed={s.id===selected} className={`${s.id===selected?'chosen ':''}${doneIds.has(s.id)?'submitted':''}`} onClick={()=>onSelect(s.id)}><span>{s.name}</span><small>{doneIds.has(s.id)?'已提交待审':'待登记'}</small></button>)}</div>
 {visible.length===0&&<p className="muted" role="status">没有符合当前筛选条件的学生。</p>}
 </div>;
}
