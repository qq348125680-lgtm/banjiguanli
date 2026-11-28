import {validateRecordPage} from './class-records.mjs';
/** V7 Alpha8 safe read-only bridge. Never calls insert/update/delete/upsert/rpc. */
export const MAPPING=Object.freeze({
  submissions:'cadre_submissions',students:'students',classes:'classes',delegates:'class_delegates',
  status:{pending:'待审核',approved:'已通过',rejected:'已驳回'},
  entryTypes:['考勤','违纪','请假'],
  // Existing public.cadre_submissions CHECK does not accept '成长积分'.
});
export function assertUuid(value){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value)))throw new Error('无效的UUID');return value;}
export function createReadOnlyBridge(client){
 if(!client||typeof client.from!=='function'||!client.auth?.getUser)throw new Error('需要一个已初始化的 Supabase 客户端');
 async function user(){const {data,error}=await client.auth.getUser();if(error)throw error;if(!data?.user?.id)throw new Error('请先登录');return data.user;}
 async function query(build){const {data,error}=await build;if(error)throw error;return data??[];}
 async function ownedClasses(){const u=await user();return query(client.from('classes').select('id,name,school_year,room').eq('owner_id',u.id).order('name'));}
 async function authorizedClasses(){const u=await user();const own=await ownedClasses();const delegations=await query(client.from('class_delegates').select('class_id,duty,enabled,permissions').eq('user_id',u.id).eq('enabled',true));const known=new Set(own.map(c=>c.id));return {owned:own,delegated:delegations.filter(d=>!known.has(d.class_id)).map(d=>({class_id:d.class_id,duty:d.duty,permissions:d.permissions??[],name:null})),notice:'班干部暂不具有 classes/students 的 RLS 读取权限；不能以管理员密钥绕过。'};}
 async function verifyOwner(classId){assertUuid(classId);const list=await ownedClasses();if(!list.some(c=>c.id===classId))throw new Error('当前账号不是该班级的班主任或班级不可见');}
 async function studentsForOwner(classId){await verifyOwner(classId);return query(client.from('students').select('id,student_no,name,class_id,archived_at').eq('class_id',classId).is('archived_at',null).order('student_no'));}
 async function submissionsForOwner(classId,{page=1,pageSize=10,status=null}={}){
  await verifyOwner(classId);if(!Number.isInteger(page)||page<1||![5,10,20].includes(pageSize))throw new Error('分页参数不合法');
  let q=client.from('cadre_submissions').select('id,class_id,student_id,submitted_by,entry_type,occurred_on,details,status,review_note,reviewed_by,reviewed_at,created_at',{count:'exact'}).eq('class_id',classId);
  if(status){if(!Object.values(MAPPING.status).includes(status))throw new Error('审核状态不合法');q=q.eq('status',status);}
  const {data,error,count}=await q.order('created_at',{ascending:false}).range((page-1)*pageSize,page*pageSize-1);
  if(error)throw error;return {items:data??[],count:count??null,page,pageSize};
 }
 async function mySubmissions(classId,{page=1,pageSize=10}={}){
  const u=await user();assertUuid(classId);if(!Number.isInteger(page)||page<1||![5,10,20].includes(pageSize))throw new Error('分页参数不合法');
  // Database RLS additionally limits delegate visibility to their own submissions.
  const {data,error,count}=await client.from('cadre_submissions').select('id,class_id,student_id,entry_type,occurred_on,details,status,review_note,reviewed_at,created_at',{count:'exact'}).eq('class_id',classId).eq('submitted_by',u.id).order('created_at',{ascending:false}).range((page-1)*pageSize,page*pageSize-1);
  if(error)throw error;return {items:data??[],count:count??null,page,pageSize};
 }
 async function pendingCountForOwner(classId){
  await verifyOwner(classId);
  const {count,error}=await client.from('cadre_submissions').select('id',{count:'exact',head:true}).eq('class_id',classId).eq('status','待审核');
  if(error)throw error;return count??null;
 }
 async function auditForOwner(classId,{page=1,pageSize=10}={}){
  await verifyOwner(classId);if(!Number.isInteger(page)||page<1||![5,10,20].includes(pageSize))throw Error('分页参数不合法');
  // Do not infer actor names from email or expose old_data/new_data by default.
  const {data,error,count}=await client.from('operation_audit').select('id,table_name,row_id,action,actor_id,changed_at',{count:'exact'}).eq('class_id',classId).order('changed_at',{ascending:false}).range((page-1)*pageSize,page*pageSize-1);
  if(error)throw error;return {items:data??[],count:count??null,page,pageSize};
 }

 /** Return only the owner-authorized active class's paged business records; no writes. */
 async function classRecordsForOwner(classId,kind,{page=1,pageSize=10}={}){
  assertUuid(classId);
  const def=validateRecordPage(kind,page,pageSize);
  await verifyOwner(classId);
  const members=await studentsForOwner(classId);
  // Bound class membership locally and by server RLS; never query unrelated students.
  if(members.length>500)throw Error('班级学生数量超出当前安全查询上限，请使用旧版系统');
  if(members.length===0)return {items:[],count:0,page,pageSize,students:[]};
  const ids=members.map(x=>x.id);
  let q=client.from(def.table).select(def.fields,{count:'exact'});
  q=def.classScoped?q.eq('class_id',classId).in('student_id',ids):q.in('student_id',ids);
  const {data,error,count}=await q.order(def.date,{ascending:false}).order('id',{ascending:false}).range((page-1)*pageSize,page*pageSize-1);
  if(error)throw error;
  return {items:data??[],count:count??null,page,pageSize,students:members};
 }

 const DOSSIER_TABLES=Object.freeze({
  '考勤':{table:'attendance',fields:'id,on_date,status,note,created_at',order:'on_date'},
  '请假':{table:'leave_requests',fields:'id,start_on,end_on,category,status,reason,created_at',order:'start_on'},
  '违纪':{table:'incidents',fields:'id,happened_on,category,description,points,created_at',order:'happened_on'},
  '积分':{table:'point_events',fields:'id,happened_on,rule_code,detail,status,created_at',order:'happened_on'},
  '值日':{table:'duty_assignments',fields:'id,student_id,class_id',order:'id'},
 });
 /** Exact-count server pagination: 5/10/20 rows, scoped to owned class and student. */
 async function dossierPageForOwner(classId,studentId,section,{page=1,pageSize=5}={}){
  assertUuid(classId);assertUuid(studentId);
  if(!Number.isSafeInteger(page)||page<1||![5,10,20].includes(pageSize)||(page-1)*pageSize>1000000)throw new Error('档案分页参数不合法');
  if(!Object.hasOwn(DOSSIER_TABLES,section))throw new Error('档案分类不合法');
  await verifyOwner(classId);
  const {data:student,error:studentError}=await client.from('students').select('id').eq('class_id',classId).eq('id',studentId).is('archived_at',null).maybeSingle();
  if(studentError)throw studentError;
  if(!student)throw new Error('学生不存在、已归档或无权查看');
  const def=DOSSIER_TABLES[section];
  // Server RLS remains authoritative; never fetch private identity or guardian columns.
  const start=(page-1)*pageSize;
  const q=client.from(def.table).select(def.fields,{count:'exact'}).eq('student_id',studentId).order(def.order,{ascending:false}).order('id',{ascending:false}).range(start,start+pageSize-1);
  const {data,error,count}=await q;
  if(error)throw error;
  return {items:data??[],count:count??null,page,pageSize};
 }
 async function dossierForOwner(classId,studentId){
  await verifyOwner(classId);assertUuid(studentId);
  // Both class and student ownership must be checked before accessing related rows.
  const {data:student,error:studentError}=await client.from('students').select('id,name,student_no').eq('class_id',classId).eq('id',studentId).is('archived_at',null).maybeSingle();
  if(studentError)throw studentError;if(!student)throw new Error('学生不存在、已归档或无权查看');
  const definitions=[
   ['考勤','attendance','id,on_date,status,note,created_at','on_date'],
   ['请假','leave_requests','id,start_on,end_on,category,status,reason,created_at','start_on'],
   ['违纪','incidents','id,happened_on,category,description,points,created_at','happened_on'],
   ['积分','point_events','id,happened_on,rule_code,detail,status,created_at','happened_on'],
   ['值日','duty_assignments','id,student_id,class_id','id']
  ];
  const results=await Promise.all(definitions.map(async([name,table,fields,order])=>{
   try {const {data,error}=await client.from(table).select(fields).eq('student_id',studentId).order(order,{ascending:false}).limit(20);if(error)throw error;return [name,{items:data??[],error:null}];}
   catch {return [name,{items:[],error:'本类记录暂时无法读取，请在旧版核对'}];}
  }));
  return {student,sections:Object.fromEntries(results)};
 }
 return Object.freeze({user,ownedClasses,authorizedClasses,studentsForOwner,submissionsForOwner,mySubmissions,pendingCountForOwner,auditForOwner,dossierForOwner,dossierPageForOwner,classRecordsForOwner});
}
