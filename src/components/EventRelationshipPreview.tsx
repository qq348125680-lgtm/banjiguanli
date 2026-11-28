import {useState} from 'react';
import {EVENT_FLOW_STAGES,advanceDemoStage} from '../lib/class-event-system.mjs';

const TEMPLATES=['考勤异常','请假申请','违纪处理','卫生值日','家校沟通'];
const ROLE_LINKS=[['班主任','负责审核、统筹与家校沟通'],['班干部','负责按授权登记、反馈和协作'],['学生','所有事件均回到学生档案'],['家长','需有可靠的监护人绑定后才能联系']];
export function EventRelationshipPreview({mode}:{mode:'events'|'relations'}){
 const [kind,setKind]=useState(TEMPLATES[0]);
 const [stage,setStage]=useState(EVENT_FLOW_STAGES[0]);
 const [role,setRole]=useState('班主任');
 if(mode==='relations')return <section className="panel event-rel-preview" aria-label="用户关系交互预览">
  <div className="panel-head"><div><h2>用户关系模型</h2><p>班级是工作范围，学生是业务中心；账号只代表当前授权身份</p></div><span className="count">角色设计 · 无真实账号</span></div>
  <div className="relation-example"><div className="relation-root"><strong>班级</strong><small>授权范围</small></div><div className="relation-preview-role">班主任 ↔ 班干部 ↔ 学生 ↔ 家长</div></div>
  <div className="event-kind-tabs" role="group" aria-label="体验角色关系">{ROLE_LINKS.map(([name])=><button key={name} type="button" className={role===name?'active':''} aria-pressed={role===name} onClick={()=>setRole(name)}>{name}</button>)}</div>
  <p className="event-example-explain"><strong>{role}</strong> · {ROLE_LINKS.find(([name])=>name===role)?.[1]}</p>
  <p className="muted">这是角色规则演示，不是实际账号关联。家长与学生的对应关系需在独立数据库中完成核对。</p>
 </section>;
 return <section className="panel event-flow-demo" aria-label="事件流转交互预览">
  <div className="panel-head"><div><h2>班级事件流转</h2><p>从发现问题到完成核对：角色分工与操作状态贯通</p></div><span className="count">本地演示 · 不保存</span></div>
  <div className="event-kind-tabs" role="group" aria-label="事件模板">{TEMPLATES.map(item=><button key={item} type="button" aria-pressed={item===kind} className={item===kind?'active':''} onClick={()=>{setKind(item);setStage(EVENT_FLOW_STAGES[0])}}>{item}</button>)}</div>
  <div className="event-flow-track">{EVENT_FLOW_STAGES.map((item,i)=><div key={item} className={'event-flow-step '+(i<=EVENT_FLOW_STAGES.indexOf(stage)?'done':'')}><strong>{i+1}</strong><span>{item}</span></div>)}</div>
  <div className="event-demo-action"><div><strong>当前模板：{kind}</strong><p>当前环节：{stage}。可点击推进，观察业务状态；不会创建任何学生记录。</p></div>
   <div><button type="button" className="button secondary" onClick={()=>setStage(EVENT_FLOW_STAGES[0])}>重新演示</button><button type="button" className="button" disabled={stage===EVENT_FLOW_STAGES[EVENT_FLOW_STAGES.length-1]} onClick={()=>setStage(v=>advanceDemoStage(v))}>{stage==='完成'?'演示已结束':'推进到下一环节'}</button></div>
  </div>
 </section>;
}
