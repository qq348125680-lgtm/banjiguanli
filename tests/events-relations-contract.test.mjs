import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('src/App.tsx'),adapter=read('src/lib/supabase-readonly-adapter.mjs');
const preview=read('src/components/SafePreviewWorkspace.tsx');
const eventPanel=read('src/components/EventCenterPanel.tsx');
const relationPanel=read('src/components/RelationshipCenterPanel.tsx');
test('events and relationships attach to existing navigation rather than creating duplicate top-level nav',()=>{
 assert.match(app,/setRecordTab\('events'\)/);
 assert.match(app,/setStudentTab\('relations'\)/);
 assert.match(app,/<EventCenterPanel /);
 assert.match(app,/<RelationshipCenterPanel /);
 assert.doesNotMatch(app,/type View=[^;]*\|'events'/);
});
test('owner event reader queries existing limited whitelist with no family sensitive content',()=>{
 assert.match(adapter,/async function classEventsForOwner\(/);
 assert.match(adapter,/\['家校沟通','family_contacts','id,student_id,contacted_on'/);
 assert.doesNotMatch(adapter,/\['家校沟通','family_contacts',[^\n]*(summary|followup|guardian|phone)/);
 assert.match(adapter,/\.limit\(20\)/);
});
test('role reader binds class_id, student_id and account user_id',()=>{
 assert.match(adapter,/async function classRelationshipsForOwner\(/);
 assert.match(adapter,/\.select\('class_id,user_id,student_id,duty,enabled'\)/);
 assert.match(relationPanel,/未可靠关联在读学生/);
 assert.match(eventPanel,/查看原始记录/);
});
test('public preview exercises event workflow and role model without live data',()=>{
 assert.match(preview,/EventRelationshipPreview/);
 assert.match(preview,/\['events','事件中心'/);
 assert.match(preview,/\['relations','用户关系'/);
 assert.match(preview,/数据库访问、身份认证及业务写入均不可用/);
});

test('context links take a student from event to real identity relation and back',()=>{
 const relations=read('src/components/RelationshipCenterPanel.tsx');
 const events=read('src/components/EventCenterPanel.tsx');
 assert.match(app,/function openLinkedRelations\(studentId:string\)/);
 assert.match(app,/function openLinkedEvents\(studentId:string\)/);
 assert.match(app,/setLinkedStudentId\(studentId\)/);
 assert.match(events,/focusStudentId/);
 assert.match(events,/onRelations\(item\.studentId\)/);
 assert.match(relations,/onEvents\(\(item as Student\)\.id\)/);
});

test('existing event can prefill a student-scoped persistent follow-up case without direct row mutation',()=>{
 const eventPanel=read('src/components/EventCenterPanel.tsx');
 const casePanel=read('src/components/EventCaseBoard.tsx');
 assert.match(eventPanel,/onCreateCase\(item\.studentId,item\.kind,item\.summary\)/);
 assert.match(app,/function openCaseFromEvent\(studentId:string,kind:string,summary:string\)/);
 assert.match(app,/setCaseDraft\(\{studentId,kind,title:/);
 assert.match(app,/initialDraft=\{caseDraft\}/);
 assert.match(casePanel,/initialDraft\?\.studentId/);
 assert.doesNotMatch(eventPanel,/\.insert\(|\.update\(|\.delete\(/);
});
