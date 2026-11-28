/** Invalidate two independent pending work queues on a manual class switch.
 * Authorization refresh and panel loading must never apply a response for the
 * class selected before the switch. Does not grant any access.
 */
export function invalidateSelectedClass(authorizationSeq, requestSeq) {
  if (!authorizationSeq || !requestSeq || !Number.isSafeInteger(authorizationSeq.current) || !Number.isSafeInteger(requestSeq.current)) {
    throw new Error('请求版本状态不合法');
  }
  ++authorizationSeq.current;
  ++requestSeq.current;
  return {authorization: authorizationSeq.current, data: requestSeq.current};
}
