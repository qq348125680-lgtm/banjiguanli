import {useState} from 'react';
/** Demonstrates inbox layout without fabricating staff identities or task counts. */
export function TaskInboxPreview(){
 const [role,setRole]=useState<'owner'|'cadre'>('owner');
 const groups=role==='owner'?['待指派负责人','待班主任复核','我负责处理']:['分配给我的任务','我发起待指派'];
 return <section className="panel task-inbox" aria-label="待办看板空状态预览">
  <div className="panel-head"><div><h2>我的事件待办</h2><p>按登录身份显示不同待办 · 演示布局，无实际数据</p></div><span className="count">不连接数据库</span></div>
  <div className="event-kind-tabs" role="group" aria-label="切换预览身份">
   <button type="button" className={role==='owner'?'active':''} aria-pressed={role==='owner'} onClick={()=>setRole('owner')}>班主任视角</button>
   <button type="button" className={role==='cadre'?'active':''} aria-pressed={role==='cadre'} onClick={()=>setRole('cadre')}>班干部视角</button>
  </div>
  <div className="task-inbox-total"><strong>—</strong><span>待办数量尚不可用</span><small>未登录 · 不显示虚构提醒</small></div>
  <div className="task-inbox-groups">{groups.map(group=><div className="task-inbox-group" key={group}>
   <div className="task-inbox-group-head"><strong>{group}</strong><span>—</span></div>
   <p className="muted">该类别需授权登录后读取工单，无法提前显示任务或负责学生。</p>
  </div>)}</div>
  <p className="muted">正式模块支持刷新提醒、查看指定工单和处理反馈；这里不使用消息推送，也不会产生任何业务数据。</p>
 </section>;
}
