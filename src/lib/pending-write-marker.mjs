/** Session-only, scoped markers for unresolved writes. Never store names,
 * phone numbers, email, notes, credentials, or entire business responses.
 * This is defense in depth; the database unique index remains essential.
 */
export const PENDING_KEY_PREFIX='v7:unconfirmed-operation:v1';
const LIMIT_MS=30*24*60*60*1000;
const validUuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export function pendingMarkerKey(kind,{accountId,classId,day}){
 if(!['submit','review'].includes(kind)||!validUuid(accountId)||!validUuid(classId))throw Error('无法保存不合法的操作范围');
 if(kind==='submit'&&!/^\d{4}-\d{2}-\d{2}$/.test(day??''))throw Error('提交日期不合法');
 return [PENDING_KEY_PREFIX,kind,accountId,classId,kind==='submit'?day:'review'].join(':');
}
export function savePendingMarker(storage,kind,scope,id,now=Date.now()){
 if(!storage||!validUuid(id)||!Number.isFinite(now))return false;
 try{storage.setItem(pendingMarkerKey(kind,scope),JSON.stringify({id,savedAt:now}));return true}
 catch{return false}
}
export function loadPendingMarker(storage,kind,scope,now=Date.now()){
 if(!storage)return null;
 try{
  const key=pendingMarkerKey(kind,scope);
  const raw=storage.getItem(key);if(!raw)return null;
  const v=JSON.parse(raw);
  if(!validUuid(v?.id)||!Number.isFinite(v?.savedAt)||v.savedAt>now+60_000||now-v.savedAt>LIMIT_MS){
   storage.removeItem(key);return null;
  }
  return v.id;
 }catch{return null}
}
export function clearPendingMarker(storage,kind,scope){
 if(!storage)return false;
 try{storage.removeItem(pendingMarkerKey(kind,scope));return true}catch{return false}
}
/** Browser storage can be disabled in private-mode browsers; keep RAM fallback. */
export function browserSessionStorage(){
 try{return typeof window==='undefined'?null:window.sessionStorage}catch{return null}
}
