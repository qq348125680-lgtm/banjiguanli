import {loadPendingMarker,savePendingMarker,clearPendingMarker} from './pending-write-marker.mjs';

/** Persist an intent BEFORE starting a remote write. Missing browser storage
 * must fail closed rather than risk losing the recovery marker on refresh.
 * Only identifiers and scope are saved; no student names, notes or credentials.
 */
export function beginWriteIntent(storage,kind,scope,id){
 if(!storage)return {ok:false,reason:'storage'};
 const existing=loadPendingMarker(storage,kind,scope);
 if(existing)return {ok:false,reason:'pending',id:existing};
 if(!savePendingMarker(storage,kind,scope,id))return {ok:false,reason:'storage'};
 // A browser/storage shim may silently drop writes; require a read-back.
 if(loadPendingMarker(storage,kind,scope)!==id)return {ok:false,reason:'storage'};
 return {ok:true,id};
}

/** Clear only a definitively settled intent and never remove a newer one. */
export function finishKnownWrite(storage,kind,scope,id){
 if(loadPendingMarker(storage,kind,scope)!==id)return false;
 return clearPendingMarker(storage,kind,scope);
}

/** A historical rejected request DOES NOT prove a new interrupted request
 * was saved. An explicit pending/approved attendance is positive evidence;
 * all other states remain uncertain, with no automatic second write.
 */
export function hasConfirmedAttendance(rows){
 return Array.isArray(rows)&&rows.some(row=>
  row?.entry_type==='考勤'&&['待审核','已通过'].includes(row.status));
}
