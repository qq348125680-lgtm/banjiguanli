/** Independent, non-mutating query results. Failures never masquerade as zero records. */
export async function loadScopedPanels({owned,view,reader,writer,classId,page,pageSize,filter,sanitizeList}) {
  const loadRoster=()=> owned ? reader.studentsForOwner(classId) : writer.roster(classId);
  const loadReviews=()=> owned ? reader.submissionsForOwner(classId,{page,pageSize,status:filter==='全部'?null:filter}) : reader.mySubmissions(classId,{page,pageSize});
  const tasks=[
    ['roster',loadRoster],
    ['reviews',loadReviews],
    ['pending',()=>owned?reader.pendingCountForOwner(classId):Promise.resolve(null)],
    ['audit',()=>owned&&view==='archive'?reader.auditForOwner(classId,{page,pageSize}):Promise.resolve(null)]
  ];
  const entries=await Promise.all(tasks.map(async ([name,fn])=>{
    try {return [name,{ok:true,value:await fn()}]}
    catch(error){return [name,{ok:false,error}]}
  }));
  const result=Object.fromEntries(entries);
  if(result.roster.ok){result.roster.value=owned?result.roster.value:sanitizeList(result.roster.value)}
  return result;
}
