/** Session-only progress: never represents the server's actual attendance ledger. */
export function outstandingStudents(roster,completedIds){
 const done=new Set(completedIds);
 return (Array.isArray(roster)?roster:[]).filter(s=>s?.id&&!done.has(s.id));
}
export function nextOutstanding(roster,completedIds,currentId=''){
 const left=outstandingStudents(roster,completedIds);
 if(!left.length)return '';
 const position=(Array.isArray(roster)?roster:[]).findIndex(s=>s.id===currentId);
 const after=left.find(s=>(Array.isArray(roster)?roster:[]).findIndex(x=>x.id===s.id)>position);
 return (after??left[0]).id;
}
export function markSubmissionConfirmed(completedIds,studentId){
 if(!studentId)return [...completedIds];
 return [...new Set([...completedIds,studentId])];
}
