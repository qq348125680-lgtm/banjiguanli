/** Explicit fail-closed decisions for already authorized, independently loaded panels.
 * Never interpret a failed request as a legitimate zero-count response.
 */
export function decideReadFailure(results,{owned=false,view=''}={}){
 const failed=key=>results?.[key]?.ok===false;
 const failedNames=[
  ['roster','学生名单'],['reviews','审核记录'],['pending','待审核数量'],['audit','操作日志']
 ].filter(([key])=>failed(key)&&(key==='roster'||key==='reviews'||(key==='pending'&&owned)||(key==='audit'&&owned&&view==='archive'))).map(([,label])=>label);
 return {
  blockClass:failed('roster'),
  clearReviews:failed('reviews')||failed('roster'),
  clearPending:failed('pending')||failed('roster'),
  clearAudit:failed('audit')||failed('roster'),
  failedNames
 };
}
