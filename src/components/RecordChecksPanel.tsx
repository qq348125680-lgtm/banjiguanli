import {useState} from 'react';
import {pendingRecordChecks} from '../lib/record-checks.mjs';
import type {StudentItem} from '../lib/bridge';
export function RecordChecksPanel({kind,records,students}:{kind:string;records:Record<string,unknown>[];students:StudentItem[]}){
 const checks=pendingRecordChecks(kind,records);
 const [reviewed,setReviewed]=useState<string[]>([]);
 const names=new Map(students.map(s=>[s.id,s.name]));
 if(!checks.length)return <section className="record-checks" aria-label="当前页待核对事项"><h3>当前页数据核对</h3><p className="muted">本页未发现预设的填写缺项；不代表全班或其他页没有待处理事项。</p></section>;
 return <section className="record-checks" aria-label="当前页待核对事项"><h3>当前页待核对事项（{checks.length} 条）</h3><p className="muted">这些是自动提示，未核实事实或学校审批结果。勾选“本页已查看”只作用于当前页面，不写入数据库、不作为正式结案。</p>
 <div className="record-check-list">{checks.map(item=><article key={item.id} className="record-check-item"><div><strong>{names.get(item.student_id)??'关联学生'}</strong><span>{item.reason.join('；')}</span></div><label><input type="checkbox" checked={reviewed.includes(item.id)} onChange={e=>setReviewed(v=>e.target.checked?[...v,item.id]:v.filter(id=>id!==item.id))}/>本页已查看</label></article>)}</div>
 <p className="muted">本页已查看 {checks.filter(x=>reviewed.includes(x.id)).length} / {checks.length} 条；正式异常处理、联系家长、说明补充及审核，仍须在具备授权的正式业务流程完成。</p>
 </section>;
}
