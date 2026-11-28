import {useState} from 'react';
import {LayoutDashboard,Users,ClipboardCheck,ClipboardList,BookOpen,CalendarCheck,Menu,X,ArrowLeft,ShieldCheck,Workflow,Network,ContactRound} from 'lucide-react';
import {StudentsPanel} from './StudentsPanel';
import {EventRelationshipPreview} from './EventRelationshipPreview';
import {TaskInboxPreview} from './TaskInboxPreview';
import {CaseDeadlinePreview,CaseOverviewPreview} from './CaseDeadlinePreview';
import {CaseNudgeInboxPreview} from './CaseNudgeInboxPreview';

/** Public, browser-only layout sample. Contains no accounts, rows, fake students, keys or writes. */
const TABS=[
 ['overview','工作台',LayoutDashboard],
 ['students','学生中心',Users],
 ['attendance','考勤登记',ClipboardCheck],
 ['review','审核中心',ClipboardList],
 ['records','班务记录',BookOpen],
 ['duty','值日管理',CalendarCheck],
 ['events','事件中心',Workflow],
 ['relations','用户关系',Network],
 ['guardians','家庭联系人',ContactRound]
] as const;
type Tab=typeof TABS[number][0];
export function SafePreviewWorkspace({onExit}:{onExit:()=>void}){
 const [tab,setTab]=useState<Tab>('overview'),[mobile,setMobile]=useState(false),[search,setSearch]=useState(''),[kind,setKind]=useState('考勤');
 const change=(next:Tab)=>{setTab(next);setMobile(false)};
 const headline=TABS.find(x=>x[0]===tab)?.[1]??'工作台';
 return <div className="shell safe-workspace" aria-label="不连接数据库的界面布局预览">
  <aside className={`sidebar ${mobile?'shown':''}`}><div className="brand"><div className="brand-icon">✦</div><div><strong>智慧班务</strong><small>LAYOUT PREVIEW · NO DATA</small></div><button type="button" className="icon-btn close-nav" onClick={()=>setMobile(false)} aria-label="关闭预览菜单"><X size={20}/></button></div>
   <div className="section-label">界面预览导航</div><nav>{TABS.map(([id,label,Icon])=><button type="button" key={id} className={`nav-link ${tab===id?'active':''}`} onClick={()=>change(id)}><Icon size={19}/><span>{label}</span></button>)}</nav>
   <div className="side-foot"><div className="sidebar-hint">仅用于核对布局和交互。没有账号、学生资料、数据库请求或正式审批。</div><button type="button" className="nav-link" onClick={onExit}><ArrowLeft size={18}/>退出界面预览</button></div>
  </aside>
  {mobile&&<button type="button" className="scrim" aria-label="关闭预览菜单" onClick={()=>setMobile(false)}/>}
  <div className="main"><header className="topbar"><button type="button" className="icon-btn hamburger" onClick={()=>setMobile(true)} aria-label="打开预览菜单"><Menu size={22}/></button><span>智慧班务 / <strong>{headline}</strong></span><div className="top-right"><span className="version">Alpha 47 · 无数据界面预览</span><button type="button" className="icon-btn" onClick={onExit} title="退出预览" aria-label="退出预览"><X size={19}/></button></div></header>
   <main className="content"><div className="top-heading"><div><div className="eyebrow">CLASS WORKSPACE / 界面布局体验</div><h1>{headline}</h1><p>可体验页面切换及手机布局，无法读取或更改真实班级数据。</p></div><div className="preview-class-label">当前班级<strong>未连接</strong></div></div>
    <div className="notice safe-preview-banner"><ShieldCheck size={17}/><span>安全界面预览：以下为无数据的真实布局与纯本地事件流程模板，<strong>不含模拟学生和虚构业务记录</strong>；数据库访问、身份认证及业务写入均不可用。</span></div>
    {tab==='overview'&&<><div className="stats"><div className="metric"><span>在读学生</span><b>—</b><small>尚未连接名单</small></div><div className="metric"><span>待审核</span><b>—</b><small>无法读取不显示为零</small></div><div className="metric"><span>当前身份</span><b className="metric-word">预览</b><small>非正式登录</small></div></div>
      <section className="panel"><h2>常用事务</h2><p className="muted">查看实际模块的导航结构与空白状态；操作不会写入任何记录。</p><div className="quick-grid"><button type="button" className="button secondary" onClick={()=>change('students')}>学生查询</button><button type="button" className="button secondary" onClick={()=>change('attendance')}>考勤登记</button><button type="button" className="button secondary" onClick={()=>change('review')}>待办审核</button><button type="button" className="button secondary" onClick={()=>change('records')}>班务记录</button><button type="button" className="button secondary" onClick={()=>change('events')}>事件中心</button><button type="button" className="button secondary" onClick={()=>change('relations')}>用户关系</button></div></section><TaskInboxPreview/><CaseDeadlinePreview/><CaseNudgeInboxPreview/></>}
    {tab==='students'&&<StudentsPanel students={[]} search={search} onSearch={setSearch} loading={false}/>}
    {tab==='attendance'&&<section className="panel"><h2>连续考勤</h2><p className="muted">正式系统中此处可按姓名快速筛选、只看未登记、定位下一位、记录迟到及请假。</p><div className="preview-steps"><span>日期选择</span><span>选择学生</span><span>登记类型</span><span>提交待审核</span></div><div className="preview-empty">尚未连接已授权学生名单。考勤提交已禁用。</div><button disabled className="button">提交考勤（不可用）</button></section>}
    {tab==='review'&&<section className="panel"><div className="panel-head"><div><h2>审核与班干部协作</h2><p>审核积压、重复申请及按提交人核对</p></div><span className="count">数量未知</span></div><div className="preview-empty">暂无已授权的审核记录。这里不会生成虚构的待办或审核结果。</div><button disabled className="button">批准并入账（不可用）</button></section>}
    {tab==='records'&&<section className="panel"><div className="panel-head"><div><h2>班务记录中心</h2><p>六类业务的只读筛选、分页、核对与安全导出</p></div><span className="count">只读版式</span></div><div className="record-tabs" role="group" aria-label="预览班务分类">{['考勤','请假','违纪','积分','值日','家校沟通'].map(x=><button key={x} type="button" aria-pressed={kind===x} className={kind===x?'active':''} onClick={()=>setKind(x)}>{x}</button>)}</div><div className="preview-empty">“{kind}”当前无可用数据。正式业务操作和导出均已禁用。</div></section>}
    {tab==='events'&&<><EventRelationshipPreview key="flow" mode="events"/><CaseOverviewPreview/></>}
    {tab==='relations'&&<EventRelationshipPreview key="links" mode="relations"/>}
    {tab==='guardians'&&<section className="panel guardian-center"><div className="panel-head"><div><h2>家庭联系人关系</h2><p>班主任登记、核实、停用 · 家长账号尚未绑定</p></div><span className="count">只读预览</span></div><div className="preview-empty">尚未连接授权班级或家庭联系人。本模块不会猜测家长身份、展示真实电话或生成虚构的联系人关系。</div><button className="button" type="button" disabled>登记联系人（预览不可用）</button></section>}
    {tab==='duty'&&<section className="panel"><h2>九人值日分工</h2><p className="muted">仅展示已确认的任务数量；不安排具体学生，也不自动写入排班。</p><div className="preview-duty-grid">{[['扫地','4人'],['拖地','3人'],['综合整理','1人'],['排桌','1人']].map(([name,n])=><div className="preview-duty-tile" key={name}><strong>{name}</strong><span>{n}</span></div>)}</div><div className="preview-empty">正式版在已授权名单内做轮换、缺席替补与公平统计。</div></section>}
   </main>
   <nav className="bottom-nav">{TABS.slice(0,4).map(([id,label,Icon])=><button type="button" key={id} className={tab===id?'active':''} onClick={()=>change(id)}><Icon size={20}/><small>{label}</small></button>)}</nav>
  </div>
 </div>;
}
