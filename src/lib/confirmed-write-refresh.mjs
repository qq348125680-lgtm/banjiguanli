/** Follow-up reads cannot retroactively turn an already confirmed remote
 * INSERT/RPC into an uncertain write. Treat any post-write read failure as a
 * refresh-only failure, never as a reason to retry or re-lock the mutation.
 */
export async function refreshAfterConfirmedWrite(refresh){
 try{
  const complete=await refresh();
  return complete===true?{ok:true}:{ok:false,reason:'incomplete'};
 }catch(error){
  return {ok:false,reason:'error',error};
 }
}
