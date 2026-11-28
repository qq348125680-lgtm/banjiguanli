import test from 'node:test';
import assert from 'node:assert/strict';
import {buildClassRelationships} from '../src/lib/class-relationships.mjs';
const classId='class-a',ownerId='owner-a';
const students=[
 {id:'s1',name:'虚构学生1',student_no:'01',class_id:classId,archived_at:null},
 {id:'s2',name:'虚构学生2',student_no:'02',class_id:classId,archived_at:null},
 {id:'arch',name:'归档',student_no:'03',class_id:classId,archived_at:'2026-01-01'},
 {id:'other',name:'跨班',student_no:'04',class_id:'class-b',archived_at:null}
];
test('owner roster and cadre/student account relationships reflect real verified IDs',()=>{
 const view=buildClassRelationships({classId,className:'A班',ownerId,students,delegates:[
  {class_id:classId,user_id:'uid-1',student_id:'s1',duty:'班长',enabled:true},
  {class_id:classId,user_id:'uid-2',student_id:'arch',duty:'宣传委员',enabled:false},
  {class_id:'class-b',user_id:'uid-3',student_id:'other',duty:'班长',enabled:true}
 ]});
 assert.equal(view.memberCount,2);
 assert.equal(view.accountCount,2);
 assert.equal(view.cadres[0].studentName,'虚构学生1');
 assert.equal(view.cadres[1].studentName,null);
 assert.equal(view.cadres[1].enabled,false);
 assert.equal(view.students.length,2);
 assert.equal(view.guardianConnections,'not_loaded');
});
test('never guess parent relations or identify unlinked UID from other class',()=>{
 const result=buildClassRelationships({classId,className:'A班',ownerId,students,delegates:[
  {class_id:classId,user_id:'uid-out',student_id:'other',duty:'干部',enabled:true}
 ]});
 assert.equal(result.cadres[0].studentId,null);
 assert.equal(result.cadres[0].studentName,null);
 assert.equal(Object.keys(result).includes('parentPhone'),false);
});
test('missing class, owner, students or delegates should fail rather than show zero',()=>{
 for(const config of [
  {classId:'',className:'A班',ownerId,students,delegates:[]},
  {classId,className:'A班',ownerId:null,students,delegates:[]},
  {classId,className:'A班',ownerId,students:null,delegates:[]},
  {classId,className:'A班',ownerId,students,delegates:null}
 ])assert.throws(()=>buildClassRelationships(config),/不完整/);
});
