/** Protects already loaded data during refresh without crossing the authorization boundary. */
export function decideSnapshot(previousScope, accountId, classId) {
  if (!accountId || !classId) return {scope:'',clear:true};
  const scope=`${accountId}:${classId}`;
  return {scope,clear:previousScope!==scope};
}
export function resultPolicy(result,previous) {
  // An unsuccessful refresh preserves the last successful value; it never converts unknown into zero.
  return result.ok ? {value:result.value,stale:false} : {value:previous,stale:previous!==null};
}

/** Reconcile a fresh server authorization snapshot with the currently selected class.
 * Refusing to retain a removed class is more important than preserving its cache.
 */
export function reconcileAuthorization(data,currentClassId){
 const own=Array.isArray(data?.owned)?data.owned:[];
 const delegated=Array.isArray(data?.delegated)?data.delegated:[];
 const allowed=[...own.map(v=>v.id),...delegated.map(v=>v.class_id)].filter(Boolean);
 return {authorized:allowed.includes(currentClassId),nextClassId:allowed.includes(currentClassId)?currentClassId:(allowed[0]??'')};
}

/** No sensitive query should begin before scope authorization is confirmed.
 * The verifiedOverride is only passed by the same awaited successful verification.
 * Server-side RLS remains mandatory: this is a UI fail-closed guard, not permission granting.
 */
export function canReadAuthorizedScope({hasBridge,hasUser,classId,authorizedClassIds=/** @type {string[]} */ ([]),authorizationBlocked,verifiedOverride=false}) {
  // The requested class must be in the currently verified ownership/delegation list.
  // This is a frontend guard, not a replacement for the database RLS policies.
  return Boolean(hasBridge && hasUser && classId &&
    Array.isArray(authorizedClassIds) && authorizedClassIds.includes(classId) &&
    (!authorizationBlocked || verifiedOverride));
}

/** Foreground authorization refresh: only after real account is active and a debounce interval passed. */
export function shouldRevalidateForeground({visible,activeUserId,renderedUserId,inFlight,lastCheck,now,minIntervalMs=60_000}) {
 return Boolean(visible && activeUserId && activeUserId===renderedUserId && !inFlight &&
   Number.isFinite(now) && now-lastCheck>=minIntervalMs);
}
