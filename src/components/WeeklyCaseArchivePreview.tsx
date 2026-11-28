/** No-data preview only. These placeholders are not class-wide statistics. */
export function WeeklyCaseArchivePreview(){
 return <div aria-label="事件周报和结案档案预览">
  <section className="panel weekly-case-report">
   <div className="panel-head"><div><h2>班主任事件跟进周报</h2><p>按学校周一至周日生成工单与处理流水摘要</p></div><span className="count">只读预览</span></div>
   <div className="weekly-metrics">{['新建工单','结案操作','提交反馈','人工催办','家校沟通跟进'].map(k=><div key={k} className="weekly-metric"><strong>—</strong><span>{k}</span><small>尚无授权数据</small></div>)}</div>
   <div className="preview-empty">正式系统可以选择周次、核对各事件类别，并复制或导出不含学生隐私的周报文字。公开预览不会编造数据，也不能导出虚构的工作成果。</div>
  </section>
  <section className="panel closed-case-archive">
   <div className="panel-head"><div><h2>结案工单归档</h2><p>按结案日期、类别筛选原工单及完整处理流水</p></div><span className="count">无数据预览</span></div>
   <div className="preview-empty">尚未连接有效班主任账号，不能读取真实结案记录或家校沟通内容。退回重办的工单会离开“已结案”列表，而不会复制历史档案。</div>
   <button className="button secondary" type="button" disabled>查看结案处理流水（预览不可用）</button>
  </section>
 </div>;
}
