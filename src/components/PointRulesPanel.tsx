import {useEffect,useRef,useState} from 'react';
import {previewPointRule} from '../lib/point-rule-preview.mjs';
type Rule={id:string;code:string;label:string;dimension:string;unit_points:number|string|null;threshold:number|null;converted_points:number|string|null;enabled:boolean;source_note:string|null};
export function PointRulesPanel({load}:{load:()=>Promise<Rule[]>}){
 const [rules,setRules]=useState<Rule[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState(''),[search,setSearch]=useState(''),[showDisabled,setShowDisabled]=useState(false);
 const [overrides,setOverrides]=useState<Record<string,string>>({}),[counts,setCounts]=useState<Record<string,number>>({}),[refresh,setRefresh]=useState(0);
 const seq=useRef(0);
 useEffect(()=>{
  const id=++seq.current;setRules([]);setError('');setBusy(true);setOverrides({});setCounts({});
  load().then(data=>{if(id===seq.current)setRules(data)}).catch(()=>{if(id===seq.current)setError('积分规则读取失败。未显示旧缓存，请重新验证班级授权。')}).finally(()=>{if(id===seq.current)setBusy(false)});
  return ()=>{seq.current++};
 },[load,refresh]);
 const filtered=rules.filter(r=>(showDisabled||r.enabled)&&[r.label,r.code,r.dimension].some(v=>String(v??'').includes(search.trim())));
 return <section className="panel point-rules-panel" aria-label="积分规则中心">
  <div className="panel-head"><div><h2>积分与违纪规则</h2><p>读取本班现有规则配置；输入仅用于试算，不会保存到数据库。</p></div><span className="count">{busy?'读取中':`${filtered.length} 项`}</span></div>
  <div className="point-rule-controls"><label>查找规则 <input aria-label="搜索积分规则" value={search} onChange={e=>setSearch(e.target.value)} placeholder="项目名称、编码或维度"/></label>
   <label className="point-disabled"><input type="checkbox" checked={showDisabled} onChange={e=>setShowDisabled(e.target.checked)}/>显示已停用规则</label>
   <button type="button" className="record-refresh" disabled={busy} onClick={()=>setRefresh(v=>v+1)}>重新读取规则</button></div>
  {error&&<p role="alert" className="notice error">{error}</p>}
  {!busy&&!error&&!filtered.length&&<p className="muted">本班没有符合条件的规则配置；不会自动生成所谓学校官方扣分标准。</p>}
  <div className="point-rule-grid">{filtered.map(rule=>{
   let value;
   let trialError='';
   try{value=previewPointRule(rule,counts[rule.id]??1,overrides[rule.id]===undefined?null:overrides[rule.id])}
   catch(e){trialError=e instanceof Error?e.message:'无法试算'}
   return <article key={rule.id} className="point-rule-item">
    <div className="point-rule-head"><strong>{rule.label||'未命名规则'}</strong><span>{rule.enabled?'已启用':'已停用'}</span></div>
    <p className="muted">{rule.dimension||'未分类'} · {rule.code||'未设置编码'}</p>
    <p>数据库每次分值：<strong>{rule.unit_points??'未配置'}</strong>{rule.threshold!=null&&<span> · 阈值 {rule.threshold}</span>}{rule.converted_points!=null&&<span> · 折算分值 {rule.converted_points}</span>}</p>
    {rule.source_note&&<p className="muted">规则来源备注：{rule.source_note}</p>}
    <div className="point-rule-trial"><label>试算次数<input type="number" min={1} max={20} step={1} value={counts[rule.id]??1} onChange={e=>setCounts(v=>({...v,[rule.id]:Number(e.target.value)}))}/></label>
     <label>临时分值<input aria-label={`${rule.label}试算分值`} type="number" step="0.5" placeholder="使用数据库分值" value={overrides[rule.id]??''} onChange={e=>setOverrides(v=>({...v,[rule.id]:e.target.value}))}/></label>
     <span>试算参考 <strong>{trialError?'—':value?.total}</strong></span></div>
    {trialError&&<p role="alert" className="muted">{trialError}</p>}
    {value?.requiresThresholdReview&&<p className="muted">该规则存在累计阈值，以上仅按每次分值相乘，<strong>不包含正式阈值折算</strong>。</p>}
   </article>;
  })}</div>
  <p className="muted">此页面不核定学生手册条款是否最新、不自动加减分，也不修改任何现有规则；正式规则调整和学生积分入账继续在原系统中操作。</p>
 </section>;
}
