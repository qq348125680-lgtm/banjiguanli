import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('real dashboard binds task inbox to checked account and class, not guest preview',()=>{
 const app=read('src/App.tsx');
 assert.match(app,/const fetchTaskInbox=useCallback\(async\(\)=>/);
 assert.match(app,/authorizationBlocked\|\|authorizationChecking/);
 assert.match(app,/bridges\.cases\.taskInbox\(classId\)/);
 assert.match(app,/<TaskInboxPanel key=/);
 assert.match(app,/load=\{fetchTaskInbox\} roster=\{roster\} onOpen=\{openExactCase\}/);
 assert.match(app,/function openExactCase\(caseId:string\)/);
 assert.match(app,/setCaseFocusId\(caseId\);setRecordTab\('cases'\)/);
});
test('owner/student dossier and cadre both route to server-filtered case board',()=>{
 const app=read('src/App.tsx'),panel=read('src/components/EventCaseBoard.tsx');
 const dossier=read('src/components/StudentDossierPanel.tsx');
 assert.match(app,/function openStudentCases\(studentId:string\)/);
 assert.match(app,/onOpenCases=\{openStudentCases\}/);
 assert.match(dossier,/查看事件工单/);
 assert.equal((app.match(/initialStudentId=\{caseStudentId\} initialCaseId=\{caseFocusId\}/g)||[]).length,2);
 assert.match(panel,/initialStudentId/);
 assert.match(panel,/initialCaseId/);
 assert.match(panel,/api\.list\(classId,\{page,pageSize:10,status:filter,studentId:studentScope,caseId:caseScope\}\)/);
 assert.match(panel,/查看全部工单/);
});
test('dashboard reminders use exact scoped reads and never invent unread push counters',()=>{
 const api=read('src/lib/event-case-api.mjs'),domain=read('src/lib/event-task-inbox.mjs');
 assert.match(api,/async function taskInbox\(classId\)/);
 assert.match(api,/\.select\('id,class_id,student_id,kind,title,status,assigned_to,created_by,updated_at',\{count:'exact'\}\)/);
 assert.match(api,/\.eq\('class_id',classId\)\.eq\('status',group\.status\)/);
 assert.match(api,/assertInboxQueryResult\(response,group,classId\)/);
 assert.match(domain,/count:response\.count/);
 assert.match(domain,/不是已读回执/);
 assert.doesNotMatch(domain,/localStorage|notify\(|pushManager|subscription/);
});
test('safe preview renders role-switching empty task cards with no fake members',()=>{
 const preview=read('src/components/SafePreviewWorkspace.tsx');
 const empty=read('src/components/TaskInboxPreview.tsx');
 assert.match(preview,/<TaskInboxPreview\/>/);
 assert.match(empty,/班主任视角/);
 assert.match(empty,/班干部视角/);
 assert.match(empty,/待办数量尚不可用/);
 assert.doesNotMatch(empty,/\.rpc\(|\.from\(|\.insert\(|fakeStudent|sb_publishable/);
});
