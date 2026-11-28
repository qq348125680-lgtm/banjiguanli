/** Public technical preview only: never make fake class statistics appear real. */
export function CaseDeadlinePreview(){
 return <section className="panel case-due-reminder" aria-label="处理期限提醒布局预览">
  <div className="panel-head"><div><h2>处理期限提醒</h2><p>到期分组 · 需要授权登录后才能读取</p></div><span className="count">预览不可查询</span></div>
  <div className="case-due-grid">{['已逾期','今天到期','未来三天到期'].map(label=><div className="case-due-group" key={label}>
   <div className="case-due-group-title"><strong>{label}</strong><b>—</b></div>
   <p className="muted">尚未连接班级工单，不能将未知数量视为零。</p>
  </div>)}</div>
  <p className="muted">正式页面中点击到期任务可以打开对应工单；这里没有账号、记录或推送。</p>
 </section>;
}
export function CaseOverviewPreview(){
 return <section className="panel class-case-overview" aria-label="事件工单统计布局预览">
  <div className="panel-head"><div><h2>班级事件办理统计</h2><p>按状态、类别和负责人汇总真实事件工单</p></div><span className="count">无数据预览</span></div>
  <div className="case-overview-summary">{['工单总量','未结案','已结案'].map(label=><div key={label}><b>—</b><span>{label}</span></div>)}</div>
  <div className="case-overview-columns"><div><h3>按处理状态</h3><div className="case-overview-types">{['待分派','处理中','待复核','已结案'].map(k=><div key={k}><span>{k}</span><strong>—</strong></div>)}</div></div>
   <div><h3>按事件类别</h3><div className="case-overview-types">{['考勤','请假','违纪','积分','值日','家校沟通','其他'].map(k=><div key={k}><span>{k}</span><strong>—</strong></div>)}</div></div></div>
  <p className="muted">没有经过班主任身份核验时，不展示负责人的姓名、任务量或实际班级信息。</p>
 </section>;
}
