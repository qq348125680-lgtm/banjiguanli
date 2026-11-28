import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const app = fs.readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const refresh=app.slice(app.indexOf('async function verifiedRefresh()'),app.indexOf('async function login()'));
test('authorization query happens before data refresh',()=>{
 assert.ok(refresh.indexOf('authorizedClasses()') < refresh.indexOf('await loadData(['));
});
test('authorization refresh failure clears previously loaded personal records',()=>{
 const clause=refresh.slice(refresh.indexOf('}catch(e){'));
 for(const fragment of ['setAuthorizationBlocked(true)','setStudents([])','setRoster([])','setRosterLoaded(false)','setItems([])','setAudits([])',"setDossierId('')",'setReviewNotes({})','setSubmittedSession([])',"setFeedback('')"]){
  assert.ok(clause.includes(fragment),`missing ${fragment}`);
 }
});
test('failed refresh invalidates inflight class requests',()=>{
 const clause=refresh.slice(refresh.indexOf('}catch(e){'));
 assert.match(clause,/\+\+requestSeq\.current/);
 assert.match(clause,/loadedScopeRef\.current=''/);
});
test('empty state asks for verified refresh, never raw class fetch',()=>{
 assert.match(app, /onClick=\{\(\)=>void verifiedRefresh\(\)\} secondary>重新验证班级授权/);
});
test('initial authorization query failure disables writes',()=>{
 const clause=app.slice(app.indexOf('const loadClasses='), app.indexOf('useEffect(()=>{',app.indexOf('const loadClasses=')));
 assert.match(clause,/setAuthorizationBlocked\(true\)/);
});

test('initial empty class selection does not masquerade as revoked access',()=>{
 assert.match(refresh, /const wasRevoked=Boolean\(classId\)/);
 assert.match(refresh, /setAuthorizationBlocked\(wasRevoked\)/);
});
