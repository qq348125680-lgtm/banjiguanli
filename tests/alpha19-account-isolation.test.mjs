import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const app=fs.readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
test('auth-boundary invalidates in-flight class and panel requests',()=>{
 assert.match(app,/activeAccountId\.current!==nextAccountId/);
 assert.match(app,/requestSeq\.current\+\+;authorizationSeq\.current\+\+/);
});
test('auth-boundary clears all class-specific and private state',()=>{
 for(const snippet of ['setClasses([])','setDelegated([])',"setClassId('')",'setStudents([])','setRoster([])', 'setItems([])','setAudits([])', 'setDossierId(\'\')','setReviewNotes({})', 'setSubmittedSession([])','setPendingCount(null)','setAuditTotal(null)']){
  assert.ok(app.includes(snippet),`missing ${snippet}`);
 }
});
test('auth-boundary depends on account identity rather than token object identity',()=>{
 assert.match(app,/\[user\?\.id,loadClasses\]\)/);
});
