/** Public technical preview: never invent nudges or imply they were delivered. */
export function CaseNudgeInboxPreview(){
 return <section className="panel case-nudge-inbox" aria-label="催办反馈闭环无数据预览">
  <div className="panel-head"><div><h2>工单催办与反馈</h2><p>班主任催办 → 班干部处理反馈 → 班主任复核</p></div><span className="count">无数据预览</span></div>
  <div className="case-nudge-count"><strong>—</strong><span>待回应催办数量尚不可用</span></div>
  <div className="preview-steps"><span>到期工单</span><span>填写催办说明</span><span>负责人提交反馈</span><span>班主任复核结案</span></div>
  <div className="preview-empty">未连接学校班级或真实账号；这里不会生成催办任务、班干部姓名、消息推送或学生数据。</div>
  <p className="muted">正式业务中催办保存于服务器，同一工单每天最多一次；反馈或转派会解除当前待回应提醒，历史保留。</p>
 </section>;
}
