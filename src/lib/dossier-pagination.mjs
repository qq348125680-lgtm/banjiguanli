/** Client-side paging ONLY over the at-most-20 fetched rows; not server-side history paging. */
export const DOSSIER_SIZES=Object.freeze([5,10,20]);
export function dossierPage(items,page=1,pageSize=5){
 if(!Array.isArray(items)||!Number.isInteger(page)||page<1||!DOSSIER_SIZES.includes(pageSize))throw new Error('档案分页参数无效');
 const total=items.length,pages=Math.max(1,Math.ceil(total/pageSize)),current=Math.min(page,pages);
 return Object.freeze({items:items.slice((current-1)*pageSize,current*pageSize),total,page:current,pages,pageSize,hasMoreOnServer:total>=20});
}
