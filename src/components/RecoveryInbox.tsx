type RecoveryItem={
 key:string;kind:string;classId:string;day:string|null;id:string|null;state:string
};
type Props={
 items:RecoveryItem[];
 unavailable:boolean;
 truncated:boolean;
 classNames:Map<string,string>;
 onLocate:(item:RecoveryItem)=>void;
};
/** Scope-only queue. Never shows a student's name, notes, phone or login. */
export function RecoveryInbox({items,unavailable,truncated,classNames,onLocate}:Props){
 if(items.length===0&&!unavailable)return null;
 return <section className="recovery-inbox" role="region" aria-label="待核对操作提醒">
  <div className="recovery-summary">
   <strong>{items.length? `有 ${items.length} 笔操作需要核对`:'未确认操作标记暂时无法读取'}</strong>
   <span>仅在当前登录账号有权限的班级中显示；不会自动重试或补写。</span>
  </div>
  {unavailable&&<p className="recovery-warning">本标签页存储读取不完整，已限制相关写入。请先检查浏览器设置，再到原系统核对。</p>}
  {truncated&&<p className="recovery-warning">本标签页标记过多，以下列表可能不完整，请使用原系统核实其余操作。</p>}
  {items.length>0&&<details>
   <summary>查看待核对记录与定位入口</summary>
   <div className="recovery-rows">{items.map(item=><div className="recovery-row" key={item.key}>
    <div>
     <strong>{classNames.get(item.classId)??'当前授权班级'} · {item.kind==='submit'?'考勤提交':'班主任审核'}</strong>
     <span>{item.day??'当前班级'} · {item.state==='pending'?'写入结果尚未确认':item.state==='stale'?'历史标记需核对':'标记异常，需人工核对'}</span>
    </div>
    {item.id?
     <button type="button" className="button secondary" onClick={()=>onLocate(item)}>定位核对</button>:
     <span className="recovery-warning">标记已损坏，请从原系统人工核实，不要重复提交</span>}
   </div>)}</div>
  </details>}
 </section>;
}
