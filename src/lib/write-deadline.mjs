/** The write may succeed AFTER the local deadline. NEVER auto-retry or
 * treat this as server rejection. The caller must lock its scoped request and
 * re-query its exact record before taking another action.
 * @template T
 * @param {()=>Promise<T>} task
 * @param {number} limitMs
 * @returns {Promise<T>}
 */
export async function withUncertainWriteDeadline(task,limitMs=30000){
 if(typeof task!=='function'||!Number.isSafeInteger(limitMs)||limitMs<50||limitMs>120000)throw Error('写入超时配置不合法');
 let timer;
 try{
  return await Promise.race([
   Promise.resolve().then(task),
   new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error('写入响应超时：结果未知，请核对服务器记录后再操作'),{code:'V7_OUTCOME_UNKNOWN'})),limitMs)})
  ]);
 }finally{if(timer!==undefined)clearTimeout(timer)}
}
