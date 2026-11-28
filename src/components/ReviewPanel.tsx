import type {Submission} from '../lib/bridge';
import {canReviewSubmission} from '../lib/domain.mjs';
import {Badge,Button} from './Common';
export type ReviewPanelProps={owned:boolean;items:Submission[];names:Map<string,string>;total:number|null;page:number;pageSize:number;filter:string;loading:boolean;busy:boolean;canWrite:boolean;notes:Record<string,string>;setNotes:(fn:(v:Record<string,string>)=>Record<string,string>)=>void;setFilter:(s:string)=>void;setPage:(fn:(v:number)=>number)=>void;setPageSize:(n:number)=>void;review:(id:string,action:'approve'|'reject')=>void};
export function ReviewPanel(p:ReviewPanelProps){
 const pages=p.total===null?null:Math.max(1,Math.ceil(p.total/p.pageSize));
 return <section className="panel"><div className="panel-head"><div><h2>{p.owned?'班主任审核中心':'我的提交记录'}</h2><p>真实记录按身份和班级权限读取；审批前服务端必须再次验证状态。</p></div><span className="count">{p.total===null?'数量未知':`${p.total} 条`}</span></div>
 <div className="filters">{p.owned&&<label>状态<select value={p.filter} onChange={e=>{p.setFilter(e.target.value);p.setPage(()=>1)}}>{['全部','待审核','已通过','已驳回'].map(v=><option key={v}>{v}</option>)}</select></label>}
 <label>每页<select value={p.pageSize} onChange={e=>{p.setPageSize(Number(e.target.value));p.setPage(()=>1)}}>{[5,10,20].map(v=><option key={v}>{v}</option>)}</select></label></div>
 <div className="item-list">{p.items.map(i=><article className="item" key={i.id}><div className="item-top"><div><strong>{p.names.get(i.student_id)??'学生（未找到或无权查看）'}</strong><span className="muted"> · {i.entry_type} · {i.occurred_on}</span></div><Badge status={i.status}/></div>
 <p>{i.entry_type==='考勤'?i.details?.status??'考勤状态未填写':'请使用旧版处理该类别'}{i.details?.note?` · ${i.details.note}`:''}</p>{i.review_note&&<p className="muted">审核备注：{i.review_note}</p>}
 {p.owned&&i.status==='待审核'&&i.entry_type!=='考勤'&&<p className="muted">该类型尚未迁移到 V7 审批接口，请在旧版正式系统处理，避免误提交。</p>}
 {p.owned&&i.status==='待审核'&&i.entry_type==='考勤'&&<div className="review-actions"><input aria-label="审核意见" placeholder="审核意见；驳回时必填" maxLength={500} value={p.notes[i.id]??''} onChange={e=>p.setNotes(v=>({...v,[i.id]:e.target.value}))}/>
 <Button disabled={!p.canWrite||p.busy||!canReviewSubmission(p.items,i.id,'approve')} onClick={()=>p.review(i.id,'approve')}>批准并入账</Button>
 <Button secondary disabled={!p.canWrite||p.busy||!canReviewSubmission(p.items,i.id,'reject')||!(p.notes[i.id]??'').trim()} onClick={()=>p.review(i.id,'reject')}>驳回</Button></div>}</article>)}</div>
 {p.items.length===0&&!p.loading&&<p className="muted">当前筛选下无可见记录；如有加载错误，请以提示信息为准。</p>}
 <div className="pagination"><Button secondary disabled={p.page<=1||p.loading} onClick={()=>p.setPage(v=>Math.max(1,v-1))}>上一页</Button><span>第 {p.page} 页 {pages?`/ 共 ${pages} 页`:''}</span><Button secondary disabled={p.loading||p.items.length<p.pageSize||(pages!==null&&p.page>=pages)} onClick={()=>p.setPage(v=>v+1)}>下一页</Button></div></section>;
}
