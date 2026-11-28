import {escapeCsvCell} from './class-records.mjs';
/** Non-authoritative, current-page quality checklist; never changes persisted status. */
export function pendingRecordChecks(kind,records){
 const result=[];
 for(const record of Array.isArray(records)?records:[]){
  const id=record?.id==null?'':String(record.id);
  if(!id)continue;
  const reason=[];
  if(kind==='考勤'){
   if(['缺勤','旷课'].includes(record.status)&&!String(record.note??'').trim())reason.push('缺勤记录缺少说明，请人工核实');
   if(!String(record.status??'').trim())reason.push('缺少考勤状态');
  }else if(kind==='请假'){
   if(['待审核','待审批','待处理'].includes(String(record.status??'')))reason.push('请假记录仍标记为待处理');
   if(record.start_on&&record.end_on&&String(record.start_on)>String(record.end_on))reason.push('请假结束日期早于开始日期');
  }else if(kind==='值日'){
   if(!String(record.area??'').trim())reason.push('值日任务未填写负责区域');
  }else if(kind==='违纪'){
   if(!String(record.category??'').trim())reason.push('违纪类别未填写');
  }
  if(reason.length)result.push({id,student_id:String(record.student_id??''),date:String(record.on_date??record.start_on??record.duty_date??record.happened_on??''),reason});
 }
 return result;
}

/** Exports only the current page of low-sensitivity follow-up items.
 * Family contact content, phone numbers and historic snapshots are never included.
 */
export function exportRecordChecksCsv(kind,checks,students){
 if(!['考勤','请假','值日','违纪'].includes(kind))throw Error('该类别不能导出异常核对清单');
 if(!Array.isArray(checks)||checks.length>20)throw Error('仅能导出当前页最多20条待核对事项');
 const nameMap=new Map((students??[]).map(s=>[s.id,s.name]));
 const rows=[['学生姓名','日期','待核对事项','处理状态']];
 for(const item of checks)rows.push([nameMap.get(item.student_id)??'学生（无法关联）',item.date??'',item.reason.join('；'),'待人工核实']);
 return '\uFEFF'+rows.map(r=>r.map(escapeCsvCell).join(',')).join('\r\n')+'\r\n';
}
