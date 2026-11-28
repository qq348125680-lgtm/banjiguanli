/** Pure local-list helpers; never query or mutate student records. */
export const PAGE_SIZES=Object.freeze([5,10,20]);
export function filterStudents(students,search=''){
 const term=String(search).trim().toLocaleLowerCase();
 if(!Array.isArray(students))return [];
 if(!term)return students;
 return students.filter(s=>[s?.name,s?.student_no].some(v=>String(v??'').toLocaleLowerCase().includes(term)));
}
export function pageStudents(students,search='',page=1,pageSize=10){
 const filtered=filterStudents(students,search);
 const size=PAGE_SIZES.includes(pageSize)?pageSize:10;
 const pages=Math.max(1,Math.ceil(filtered.length/size));
 const current=Number.isSafeInteger(page)?Math.min(Math.max(1,page),pages):1;
 return {items:filtered.slice((current-1)*size,current*size),total:filtered.length,page:current,pages,pageSize:size};
}
export function progressStudents(roster,completed,search='',onlyOutstanding=false){
 const list=Array.isArray(roster)?roster:[];
 const ids=new Set(Array.isArray(completed)?completed:[]);
 const remaining=list.filter(s=>!ids.has(s.id));
 const visible=filterStudents(onlyOutstanding?remaining:list,search);
 return {remaining,visible,done:list.length-remaining.length,total:list.length};
}
