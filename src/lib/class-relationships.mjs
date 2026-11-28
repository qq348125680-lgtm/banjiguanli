/** A user-class relationship read model made ONLY from verified current-class
 * owner, active students and class_delegates. Guardians have no inferred link.
 */
export function buildClassRelationships({classId,className,ownerId,students,delegates}){
 if(!classId||!ownerId||!Array.isArray(students)||!Array.isArray(delegates))throw Error('班级关系数据不完整');
 const members=new Map(students.filter(x=>x?.id&&!x.archived_at&&(!x.class_id||x.class_id===classId)).map(x=>[x.id,x]));
 const relations=[];
 const cadreAccounts=new Map();
 for(const row of delegates){
  if(!row||row.class_id!==classId||typeof row.user_id!=='string')continue;
  // Do not invent a student identity for an unlinked, archived or cross-class user.
  const linked=members.get(row.student_id);
  const item={key:'cadre:'+row.user_id+':'+(row.student_id??''),studentId:linked?.id??null,
   studentName:linked?.name??null,accountId:row.user_id,
   role:row.duty||'班干部',enabled:row.enabled===true};
  relations.push(item);
  cadreAccounts.set(row.user_id,true);
 }
 relations.sort((a,b)=>Number(b.enabled)-Number(a.enabled)||a.role.localeCompare(b.role)||a.key.localeCompare(b.key));
 return {
  classId,className:className||'当前班级',ownerId,
  students:[...members.values()].sort((a,b)=>String(a.student_no??'').localeCompare(String(b.student_no??''))),
  cadres:relations,memberCount:members.size,
  accountCount:cadreAccounts.size,
  // Parents are never manufactured from student names, phone numbers or chat records.
  guardianConnections:'not_loaded'
 };
}
