/** Whitelisted, owner-only class record categories. Never use arbitrary table names from UI input. */
export const CLASS_RECORDS=Object.freeze({
 '考勤':Object.freeze({table:'attendance',fields:'id,student_id,on_date,status,note',date:'on_date'}),
 '请假':Object.freeze({table:'leave_requests',fields:'id,student_id,start_on,end_on,category,status,reason',date:'start_on'}),
 '违纪':Object.freeze({table:'incidents',fields:'id,student_id,happened_on,category,description,points',date:'happened_on'}),
 '积分':Object.freeze({table:'point_events',fields:'id,student_id,happened_on,rule_code,detail,status',date:'happened_on'}),
 '值日':Object.freeze({table:'duty_assignments',fields:'id,student_id,duty_date,area,status,note',date:'duty_date',classScoped:true}),
 '家校沟通':Object.freeze({table:'family_contacts',fields:'id,student_id,contacted_on,method,summary,followup',date:'contacted_on'})
});
export const CLASS_RECORD_KINDS=Object.freeze(Object.keys(CLASS_RECORDS));
export function validateRecordPage(kind,page,pageSize){
 if(!Object.hasOwn(CLASS_RECORDS,kind))throw Error('不支持的班务记录分类');
 if(!Number.isSafeInteger(page)||page<1||page>10000||![5,10,20].includes(pageSize))throw Error('班务分页参数不合法');
 return CLASS_RECORDS[kind];
}
/** Only generate presentation text from explicitly selected fields; no guardian identity details. */
export function describeClassRecord(kind,item){
 const record=item??{};
 const date=record.on_date??record.start_on??record.happened_on??record.duty_date??record.contacted_on??'日期未知';
 const details={
  '考勤':[record.status,record.note],
  '请假':[record.category,record.status,record.end_on&&record.end_on!==record.start_on?('至 '+record.end_on):null,record.reason],
  '违纪':[record.category,Number.isFinite(record.points)?'分值 '+record.points:null,record.description],
  '积分':[record.rule_code,record.status,record.detail],
  '值日':[record.area,record.status,record.note],
  '家校沟通':[record.method,record.summary,record.followup]
 };
 return {date:String(date),description:(details[kind]??[]).filter(v=>v!==null&&v!==undefined&&String(v).trim()).map(v=>String(v)).join(' · ')||'未填写详情'};
}
