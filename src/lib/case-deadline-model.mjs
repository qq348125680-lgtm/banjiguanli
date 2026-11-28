/** School scheduling uses Asia/Shanghai calendar days independent of browser TZ.
 * A due date is optional; blank must never be treated as overdue.
 */
export function schoolToday(now=new Date()){
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw Error('日期不可用');
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const values=Object.fromEntries(parts.map(p=>[p.type,p.value]));
 return values.year+'-'+values.month+'-'+values.day;
}
export function validateSchoolDate(value,allowEmpty=false){
 if(allowEmpty&&value===null)return null;
 if(typeof value!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value))throw Error('请填写有效的截止日期');
 const [y,m,d]=value.split('-').map(Number);
 const utc=new Date(Date.UTC(y,m-1,d));
 if(utc.getUTCFullYear()!==y||utc.getUTCMonth()+1!==m||utc.getUTCDate()!==d)throw Error('处理期限日期不存在');
 return value;
}
export function addSchoolDays(date,days){
 validateSchoolDate(date);
 if(!Number.isSafeInteger(days)||Math.abs(days)>3650)throw Error('截止日期范围无效');
 const [y,m,d]=date.split('-').map(Number);
 return new Date(Date.UTC(y,m-1,d+days)).toISOString().slice(0,10);
}
export function dueReminderDefinitions(today){
 validateSchoolDate(today);
 return Object.freeze([
  {id:'overdue',label:'已逾期',from:null,until:today,comparison:'lt'},
  {id:'today',label:'今天到期',from:today,until:today,comparison:'eq'},
  {id:'soon',label:'未来三天到期',from:today,until:addSchoolDays(today,3),comparison:'window'}
 ]);
}
export function dateMatchesBucket(dueOn,bucket){
 validateSchoolDate(dueOn);
 if(bucket.comparison==='lt')return dueOn<bucket.until;
 if(bucket.comparison==='eq')return dueOn===bucket.until;
 if(bucket.comparison==='window')return dueOn>bucket.from&&dueOn<=bucket.until;
 return false;
}
export function verifyDueResponse(response,bucket,classId,assigneeId=null){
 if(response?.error||!Array.isArray(response?.data)||!Number.isSafeInteger(response?.count)||response.count<0)
  throw Error('到期提醒读取失败，不能推断没有逾期事项');
 if(response.data.length>response.count)throw Error('到期提醒数量与记录不一致');
 for(const row of response.data){
  if(row.class_id!==classId||row.status==='已结案'||!dateMatchesBucket(row.due_on,bucket)||
   (assigneeId&&row.assigned_to!==assigneeId))
   throw Error('到期任务跨越班级、状态或责任人范围');
 }
 return {id:bucket.id,label:bucket.label,count:response.count,items:response.data.map(row=>({
  id:row.id,title:row.title,kind:row.kind,studentId:row.student_id,
  dueOn:row.due_on,status:row.status
 }))};
}
export function verifyWorkloadRows(rows,statuses,kinds){
 if(!Array.isArray(rows))throw Error('班级工单统计未返回有效数据');
 const status=Object.fromEntries(statuses.map(s=>[s,0]));
 const kind=Object.fromEntries(kinds.map(k=>[k,0]));
 const assignee={};const seen=new Set();
 for(const row of rows){
  const key=row?.dimension+':'+row?.item;
  if(seen.has(key))throw Error('工单统计返回重复分组');seen.add(key);
  const amount=typeof row.amount==='string'?Number(row.amount):row.amount;
  if(!Number.isSafeInteger(amount)||amount<0)throw Error('工单统计数值异常');
  if(row.dimension==='status'&&Object.hasOwn(status,row.item))status[row.item]=amount;
  else if(row.dimension==='kind'&&Object.hasOwn(kind,row.item))kind[row.item]=amount;
  else if(row.dimension==='assignee'&&/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(row.item))assignee[row.item]=amount;
  else throw Error('工单统计分组不受支持');
 }
 const total=Object.values(status).reduce((n,x)=>n+x,0);
 const kindsTotal=Object.values(kind).reduce((n,x)=>n+x,0);
 if(total!==kindsTotal)throw Error('类别统计与工单总数不一致');
 const open=total-status['已结案'];
 if(Object.values(assignee).reduce((n,x)=>n+x,0)>open)
  throw Error('负责人待办总数超过未结案工单数');
 return {status,kind,assignee,total,open,closed:status['已结案']};
}
