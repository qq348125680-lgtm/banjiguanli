/** Fail closed when verifying RLS with actual Auth JWTs in a disposable
 * Supabase test project. Never log returned rows or user identifiers.
 */
export function assertRestrictedRead(result,label){
 if(result?.error){
  if(String(result.error.code)==='42501')return 'denied';
  throw Error(label+'：读取失败，不能把未知网络/会话错误当作权限拒绝');
 }
 if(!Array.isArray(result?.data))throw Error(label+'：响应缺少可核对的列表');
 if(result.data.length!==0)throw Error(label+'：发现不应可见的业务行，权限验收失败');
 return 'empty';
}
export function assertOwnedSubmissionRows(result,accountId,classId){
 if(result?.error||!Array.isArray(result?.data))throw Error('班干部记录读取失败，无法完成权限验收');
 if(!accountId||!classId)throw Error('班干部身份或班级不明确');
 for(const row of result.data){
  if(row?.submitted_by!==accountId||row?.class_id!==classId)throw Error('班干部可以读取非本人或其他班级的申请，阻断正式版');
 }
 return result.data.length;
}
export function requireForeignSyntheticFixture(ownerRows,cadreId,classId){
 if(!Array.isArray(ownerRows)||!cadreId||!classId)throw Error('缺少班主任完整测试记录');
 const external=ownerRows.filter(row=>row?.class_id===classId&&row?.submitted_by&&row.submitted_by!==cadreId);
 if(external.length===0)throw Error('测试班没有其他账号提交的虚构申请，不能证明 RLS 是否隔离不同干部；请先在隔离库造样本');
 return new Set(external.map(row=>row.id));
}
export function assertNoForeignRows(cadreRows,foreignIds){
 if(!Array.isArray(cadreRows)||!(foreignIds instanceof Set)||foreignIds.size===0)throw Error('RLS 反向测试样本不完整');
 if(cadreRows.some(row=>foreignIds.has(row?.id)))throw Error('检测到跨干部泄露了另一账号的申请记录');
 return true;
}
