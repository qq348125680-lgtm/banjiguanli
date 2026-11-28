/** School-local dates and verified numeric weekly report.
 * Weekly actions are counts of audit operations, not unique closed students/cases.
 */
import {schoolToday,validateSchoolDate,addSchoolDays} from './case-deadline-model.mjs';
import {CASE_KINDS} from './event-case-api.mjs';

export const WEEKLY_ACTIONS=Object.freeze(['创建','指派','转派','反馈','结案','退回','催办','设置期限','调整期限','取消期限']);
export function weekMonday(date=schoolToday()){
 validateSchoolDate(date);
 const [y,m,d]=date.split('-').map(Number);
 const day=new Date(Date.UTC(y,m-1,d)).getUTCDay();
 return addSchoolDays(date,-((day+6)%7));
}
export function weeklyDates(monday){
 validateSchoolDate(monday);
 if(weekMonday(monday)!==monday)throw Error('周报开始日期必须为星期一');
 return {start:monday,end:addSchoolDays(monday,6),endExclusive:addSchoolDays(monday,7)};
}
function resultNumber(value){
 if(typeof value==='string'&&!/^(0|[1-9]\d*)$/.test(value))throw Error('周报计数格式不正确');
 const num=typeof value==='number'?value:Number(value);
 if(!Number.isSafeInteger(num)||num<0)throw Error('周报计数不是有效的非负整数');
 return num;
}
export function verifyWeeklyRows(rows){
 if(!Array.isArray(rows))throw Error('周报统计尚未从数据库完整读取');
 const created=Object.fromEntries(CASE_KINDS.map(x=>[x,0]));
 const closed=Object.fromEntries(CASE_KINDS.map(x=>[x,0]));
 const actions=Object.fromEntries(WEEKLY_ACTIONS.map(x=>[x,0]));
 const seen=new Set();
 for(const row of rows){
  const key=row?.metric+'|'+row?.item;
  if(seen.has(key))throw Error('周报统计存在重复分类');
  seen.add(key);
  const n=resultNumber(row?.amount);
  if(row.metric==='created'&&Object.hasOwn(created,row.item))created[row.item]=n;
  else if(row.metric==='closed'&&Object.hasOwn(closed,row.item))closed[row.item]=n;
  else if(row.metric==='action'&&Object.hasOwn(actions,row.item))actions[row.item]=n;
  else throw Error('周报统计出现未经支持的分类');
 }
 const createdTotal=Object.values(created).reduce((a,b)=>a+b,0);
 const closedTotal=Object.values(closed).reduce((a,b)=>a+b,0);
 if(actions['创建']!==createdTotal||actions['结案']!==closedTotal)
  throw Error('周报业务记录和处理流水计数不一致，拒绝生成不完整报表');
 return {created,closed,actions,createdTotal,closedTotal,reviewCount:actions['反馈'],
  nudgeCount:actions['催办'],reopenCount:actions['退回'],
  familyCreated:created['家校沟通'],familyClosed:closed['家校沟通']};
}
const n=(num)=>String(num??0);
export function buildWeeklyReportText(className,start,stats){
 const {end}=weeklyDates(start);
 if(typeof className!=='string'||!className.trim()||className.trim().length>80)throw Error('班级名称缺失');
 if(!stats||!Number.isSafeInteger(stats.createdTotal)||!Number.isSafeInteger(stats.closedTotal))
  throw Error('周报统计尚未完成验证');
 return [
  `${className.trim()}｜班级事件跟进周报`,
  `周期：${start} 至 ${end}（学校时间）`,
  '',
  '一、工单流转（全部为数据库实际记录）',
  `本周新建工单：${n(stats.createdTotal)} 件`,
  `本周结案操作：${n(stats.closedTotal)} 次`,
  `本周反馈提交：${n(stats.reviewCount)} 次`,
  `本周退回补充：${n(stats.reopenCount)} 次`,
  `本周手动催办：${n(stats.nudgeCount)} 次`,
  '',
  '二、新建工单类别',
  ...CASE_KINDS.map(k=>`${k}：${n(stats.created[k])} 件`),
  '',
  '三、家校沟通跟进',
  `新建家校沟通跟进工单：${n(stats.familyCreated)} 件`,
  `家校沟通工单结案操作：${n(stats.familyClosed)} 次`,
  '',
  '四、统计口径',
  '工单新建按创建时间计算；反馈、结案、催办、退回按处理流水发生时间计算。',
  '结案为操作次数，含重复结案的可能，不等于本周新建工单中已完成的数量。',
  '本报表不含学生姓名、监护人电话或谈话正文，不等于全班全部考勤/请假/家校沟通流水。',
  '数据仅供班主任内部核对，正式归档前请结合原始业务台账复核。',
 ].join('\n');
}
