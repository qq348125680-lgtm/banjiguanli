/** Fail a stalled *read* visibly; this does not cancel the underlying query.
 * Consumers must also invalidate their sequence token to ignore late responses.
 * @template T
 * @param {()=>Promise<T>} task
 * @param {number} limitMs
 * @returns {Promise<T>}
 */
export async function withReadDeadline(task,limitMs=25000){
 if(typeof task!=='function'||!Number.isSafeInteger(limitMs)||limitMs<20||limitMs>120000)throw Error('读取超时参数不合法');
 let timer;
 try{
  return await Promise.race([
   Promise.resolve().then(task),
   new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('读取超时，请检查网络并重新验证权限后重试')),limitMs)})
  ]);
 }finally{
  if(timer!==undefined)clearTimeout(timer);
 }
}
