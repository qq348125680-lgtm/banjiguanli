import type {Submission} from '../lib/bridge';
import {summarizeVisibleReviews} from '../lib/reports-summary.mjs';
export function ReportsPanel({items,rosterCount,rosterLoaded,pendingCount,owned,total,loading,onReview}:{items:Submission[];rosterCount:number;rosterLoaded:boolean;pendingCount:number|null;owned:boolean;total:number|null;loading:boolean;onReview:()=>void}){
 const summary=summarizeVisibleReviews(items);
 return <section className="panel" aria-label="数据分析">
  <div className="panel-head"><div><h2>班级数据概览</h2><p>只根据当前账号已获授权的数据统计，不生成模拟图表。</p></div><span className="count">只读</span></div>
  <div className="report-metrics">
   <div className="report-metric"><span>可见学生</span><strong>{rosterLoaded?rosterCount:'—'}</strong><small>{rosterLoaded?'当前授权班级':'数据未加载或读取失败'}</small></div>
   <div className="report-metric"><span>待审核申请</span><strong>{owned&&pendingCount!==null?pendingCount:'—'}</strong><small>{owned?'班主任权限 · 服务端计数':'不提供全班待审数据'}</small></div>
   <div className="report-metric"><span>当前已加载审核记录</span><strong>{summary.sampleSize}</strong><small>{total===null?'总记录数未知':`服务端记录总数 ${total} 条`}</small></div>
  </div>
  <div className="report-breakdown"><h3>当前已加载记录的状态分布</h3><p className="muted">以下仅统计本次已加载的 {summary.sampleSize} 条记录，不代表全班、整月或整学期。</p>
   <div className="report-status-list">{Object.entries(summary.statuses).map(([name,count])=><div key={name} className="report-status"><span>{name}</span><div className="report-track"><div className="report-fill" style={{width:`${summary.sampleSize?count/summary.sampleSize*100:0}%`}}/></div><strong>{count}</strong></div>)}</div>
   {loading&&<p className="muted" role="status">正在刷新统计数据…</p>}
   <button type="button" className="button secondary" onClick={onReview}>查看审核记录与分页</button>
  </div>
  <p className="muted">请假、积分、违纪、值日的全班趋势尚未接入经验证的统计接口；旧版系统继续提供这些正式报表。当前页面不提供敏感记录导出。</p>
 </section>;
}
