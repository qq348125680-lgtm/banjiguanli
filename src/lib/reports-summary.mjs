/** Derive bounded statistics from data already authorized and loaded by the caller. */
export function summarizeVisibleReviews(items){
 const list=Array.isArray(items)?items:[];
 const statuses={'待审核':0,'已通过':0,'已驳回':0,'其他':0};
 for(const row of list){
  const status=row?.status;
  if(Object.hasOwn(statuses,status))statuses[status]++;
  else statuses['其他']++;
 }
 return {sampleSize:list.length,statuses};
}
