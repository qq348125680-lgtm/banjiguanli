import {PENDING_KEY_PREFIX,pendingMarkerKey} from './pending-write-marker.mjs';

const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const MAX_AGE_MS=30*24*60*60*1000;

/** Read-only inspection. Even an old marker may identify a remote write, so
 * a valid UUID can still be reconciled while the marker stays locked.
 */
export function inspectPendingMarker(storage,kind,scope,now=Date.now()){
 if(!storage)return {state:'unavailable',id:null};
 let raw;
 try{raw=storage.getItem(pendingMarkerKey(kind,scope))}
 catch{return {state:'unavailable',id:null}}
 if(raw===null||raw===undefined)return {state:'missing',id:null};
 try{
  const parsed=JSON.parse(raw);
  const id=uuid(parsed?.id)?parsed.id:null;
  if(!id)return {state:'damaged',id:null};
  const timestamp=parsed.savedAt;
  const current=Number.isFinite(now)?now:Date.now();
  const validTime=Number.isFinite(timestamp)&&timestamp>=0&&timestamp<=current+60_000&&current-timestamp<=MAX_AGE_MS;
  return {state:validTime?'pending':'stale',id};
 }catch{return {state:'damaged',id:null}}
}

/** Enumerate only the signed-in account's CURRENTLY authorized classes.
 * No student names, notes or arbitrary storage keys are returned.
 * A marker found in another account/class is deliberately invisible.
 */
export function listAuthorizedPendingMarkers(storage,accountId,classIds,now=Date.now()){
 const blank={items:[],unavailable:false,truncated:false};
 if(!uuid(accountId)||!Array.isArray(classIds))return blank;
 if(!storage)return {...blank,unavailable:true};
 const authorized=new Set(classIds.filter(uuid));
 let count;
 try{count=storage.length;if(!Number.isSafeInteger(count)||count<0)throw Error('bad storage length')}
 catch{return {...blank,unavailable:true}}
 const items=[];
 const maxKeys=5000;
 try{
  for(let index=0;index<Math.min(count,maxKeys);index++){
   const key=storage.key(index);
   if(typeof key!=='string'||!key.startsWith(PENDING_KEY_PREFIX+':'))continue;
   const parts=key.slice(PENDING_KEY_PREFIX.length+1).split(':');
   if(parts.length!==4)continue;
   const [kind,account,classId,datePart]=parts;
   if(account!==accountId||!authorized.has(classId)||!['submit','review'].includes(kind))continue;
   if(kind==='submit'&&!/^\d{4}-\d{2}-\d{2}$/.test(datePart))continue;
   if(kind==='review'&&datePart!=='review')continue;
   const day=kind==='submit'?datePart:null;
   const scope={accountId,classId,day:day??undefined};
   if(pendingMarkerKey(kind,scope)!==key)continue;
   const inspected=inspectPendingMarker(storage,kind,scope,now);
   if(inspected.state==='missing')continue;
   items.push({key,kind,classId,day,id:inspected.id,state:inspected.state});
  }
 }catch{return {items,unavailable:true,truncated:count>maxKeys}}
 items.sort((a,b)=>a.classId.localeCompare(b.classId)||(a.day??'').localeCompare(b.day??'')||a.kind.localeCompare(b.kind));
 return {items,unavailable:false,truncated:count>maxKeys};
}
