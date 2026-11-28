import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filterStudents,pageStudents,progressStudents,PAGE_SIZES} from '../src/lib/list-view.mjs';
const roster=[
 {id:'a',name:'张一',student_no:'001'},
 {id:'b',name:'李二',student_no:'002'},
 {id:'c',name:'王三',student_no:'003'},
 {id:'d',name:'赵四',student_no:'004'},
 {id:'e',name:'孙五',student_no:'005'},
 {id:'f',name:'陈六',student_no:'006'}
];
test('Alpha39 roster searches by name and student number, without altering original',()=>{
 assert.deepEqual(filterStudents(roster,' 王 ').map(x=>x.id),['c']);
 assert.deepEqual(filterStudents(roster,'002').map(x=>x.id),['b']);
 assert.equal(roster.length,6);
});
test('Alpha39 student pages clamp to legal indices and fixed 5/10/20 page sizes',()=>{
 assert.deepEqual(PAGE_SIZES,[5,10,20]);
 const a=pageStudents(roster,'',1,5);assert.equal(a.items.length,5);assert.equal(a.pages,2);
 const b=pageStudents(roster,'',100,5);assert.equal(b.page,2);assert.deepEqual(b.items.map(x=>x.id),['f']);
 const c=pageStudents(roster,'王',999,5);assert.equal(c.page,1);assert.equal(c.total,1);
 assert.equal(pageStudents(roster,'',1,0).pageSize,10);
});
test('Alpha39 attendance progress deduplicates current session IDs and respects filters',()=>{
 const p=progressStudents(roster,['a','a','b','unknown'],'',true);
 assert.equal(p.done,2);assert.equal(p.total,6);assert.equal(p.remaining.length,4);
 assert.deepEqual(p.visible.map(x=>x.id),['c','d','e','f']);
 assert.deepEqual(progressStudents(roster,['a'],'004',true).visible.map(x=>x.id),['d']);
});
test('Alpha39 UI exposes mobile search, paged roster, and truthful audit identity',()=>{
 const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
 const students=read('../src/components/StudentsPanel.tsx');
 const entry=read('../src/components/EntryProgress.tsx');
 const audit=read('../src/components/AuditPanel.tsx');
 assert.match(students,/pageStudents/);
 assert.match(students,/学生每页数量/);
 assert.match(students,/setPage\(1\)/);
 assert.match(entry,/progressStudents/);
 assert.match(entry,/筛选考勤学生/);
 assert.match(entry,/doneIds/);
 assert.match(audit,/操作人 UID/);
 assert.doesNotMatch(audit,/actor_id\s*\?\?\s*'班主任'/);
});
