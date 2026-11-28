import fs from 'node:fs';import assert from 'node:assert/strict';
const app=fs.readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const entry=fs.readFileSync(new URL('../src/components/AttendanceEntryPanel.tsx',import.meta.url),'utf8');
const review=fs.readFileSync(new URL('../src/components/ReviewPanel.tsx',import.meta.url),'utf8');
const client=fs.readFileSync(new URL('../src/lib/client.ts',import.meta.url),'utf8');
const loader=fs.readFileSync(new URL('../src/lib/scope-loader.mjs',import.meta.url),'utf8');
const sql=fs.readFileSync(new URL('../sql/alpha45_STAGING_ONLY_SAFE_MIGRATION.sql',import.meta.url),'utf8');
assert.match(app,/六组导航|工作导航/);assert.match(app,/writesEnabled/);assert.match(review,/!p\.canWrite/);assert.match(loader,/studentsForOwner/);assert.match(loader,/submissionsForOwner/);assert.match(loader,/mySubmissions/);assert.match(app,/sanitizeList/);assert.match(client,/VITE_ENABLE_WORKFLOW_WRITES==='true'/);assert.doesNotMatch(client,/service_role|secret_key/i);assert.match(sql,/FOR UPDATE|for update/i);assert.doesNotMatch(sql,/on conflict \(student_id,on_date\) do nothing/i);console.log('Alpha12 static contract: 11 assertions PASS');

assert.match(app,/requestSeq\.current/);
assert.match(loader,/pendingCountForOwner/);
assert.match(loader,/auditForOwner/);
assert.match(app,/canSubmitAsDelegate/);
assert.match(app,/setFeedback/);
console.log('Alpha12 additional static contract: 5 assertions PASS');

assert.match(app,/<AttendanceEntryPanel/);assert.match(app,/<ReviewPanel/);assert.match(entry,/!p\.completed\.includes/);
console.log("Alpha14 extracted component contracts: 3 assertions PASS");

// Alpha 47: the public entry must not advertise a stale release or imply live access.
const landing=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.match(landing,/<title>智慧班级工作台 V7\.0 Alpha 47 · 安全技术预览<\/title>/);
assert.match(landing,/不连接学生数据，不开放业务写入/);
assert.doesNotMatch(landing,/Alpha10|Alpha 10/);
console.log('Alpha47 public landing metadata contract: 3 assertions PASS');

// Alpha 47: one unresolved operation locks the whole class/date submit scope
// or class review scope, preventing a later unknown result from overwriting its marker.
assert.match(app,/uncertainSubmit\.studentId/); // pending student remains visible for reconciliation
assert.match(app,/canSubmit=\{canSubmit&&!Boolean\(uncertainSubmit/);
assert.match(app,/canWrite=\{canWrite&&!Boolean\(uncertainReview/);
assert.match(app,/if\(uncertainReview&&uncertainReview\.accountId===user\?\.id/);
console.log('Alpha47 unresolved write scope guard: 4 assertions PASS');

// Alpha 47: record identifiers in session storage BEFORE an async write can be interrupted.
assert.match(app,/beginWriteIntent\(browserSessionStorage\(\),'submit'/);
assert.match(app,/beginWriteIntent\(browserSessionStorage\(\),'review'/);
assert.match(app,/finishKnownWrite\(browserSessionStorage\(\),'submit'/);
assert.match(app,/finishKnownWrite\(browserSessionStorage\(\),'review'/);
assert.match(app,/hasConfirmedAttendance\(records\)/);
assert.doesNotMatch(app,/savePendingMarker\(/);
console.log('Alpha47 pre-write intent and rejected-history contracts: 6 assertions PASS');

// Review recovery is class-scoped, not tied to whichever attendance date is shown.
assert.equal(app.split('scopeRef.current.startsWith(`${account}:${submittedClass}:`)').length-1,2);
console.log('Alpha47 class-scoped review recovery: 1 assertion PASS');

// Alpha47: sidebar navigation scroll stays internal, both desktop and mobile.
const css=fs.readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
assert.match(css,/\.sidebar nav\{[^}]*overflow-y:auto/);
assert.match(css,/\.sidebar nav\{[^}]*overscroll-behavior:contain/);
assert.match(css,/@media\(max-height:520px\)/);
console.log('Alpha47 safe scroll CSS: 3 assertions PASS');

// Alpha47: public preview must never turn on unfinished write paths by one flag.
assert.match(client,/VITE_V7_WRITE_GATE_ACKNOWLEDGED==='true'/);
assert.match(client,/configured&&workflowWritesRequested&&writeGateAcknowledged/);
const pagesWorkflow=fs.readFileSync(new URL('../.github/workflows/pages-safe-preview.yml',import.meta.url),'utf8');
assert.match(pagesWorkflow,/VITE_ENABLE_WORKFLOW_WRITES: 'false'/);
assert.match(pagesWorkflow,/VITE_V7_WRITE_GATE_ACKNOWLEDGED: 'false'/);
assert.match(pagesWorkflow,/npm run verify:source/);
assert.match(pagesWorkflow,/npm run preflight:offline/);
console.log('Alpha47 double write gate and public preview guard: 4 assertions PASS');


// Alpha47 recovery: authorized-only, cross-scope navigation with stale marker inspection.
const index=fs.readFileSync(new URL('../src/lib/pending-marker-index.mjs',import.meta.url),'utf8');
const guard=fs.readFileSync(new URL('../src/lib/write-intent-guard.mjs',import.meta.url),'utf8');
const inbox=fs.readFileSync(new URL('../src/components/RecoveryInbox.tsx',import.meta.url),'utf8');
assert.match(app,/listAuthorizedPendingMarkers\(browserSessionStorage\(\),user\.id,authorizedClassIds\)/);
assert.match(app,/<RecoveryInbox items=\{recoveryQueue\.items\}/);
assert.match(app,/function locateRecovery\(/);
assert.match(app,/inspectPendingMarker\(browserSessionStorage\(\),'submit'/);
assert.match(app,/inspectPendingMarker\(browserSessionStorage\(\),'review'/);
assert.match(index,/account!==accountId\|\|!authorized\.has\(classId\)/);
assert.match(guard,/inspectPendingMarker\(storage,kind,scope\)\.id!==id/);
assert.match(inbox,/标记异常，需人工核对/);
assert.match(css,/\.recovery-inbox\{/);
console.log('Alpha47 recovery inbox source contracts: 9 assertions PASS');

// Alpha47: mobile one-tap attendance, per-student notes/status isolation.
assert.match(entry,/const selectStudent=\(id:string\)=>/);
assert.match(entry,/p\.setNote\(''\);p\.setAttendance\('出勤'\)/);
assert.match(entry,/aria-pressed=\{p\.attendance===status\}/);
assert.match(entry,/attendance-mobile-status/);
assert.match(app,/setUncertainSubmit\(null\);setNote\(''\);setAttendance\('出勤'\)/);
assert.match(css,/\.attendance-status-desktop\{display:none!important\}/);
console.log('Alpha47 phone one-tap and safe student context switch: 6 assertions PASS');

// Alpha47: a failed follow-up read must never reclassify an already-confirmed write.
assert.equal((app.match(/refreshAfterConfirmedWrite\(\(\)=>loadData\(\)\)/g)||[]).length,4);
assert.match(app,/if\(refreshed\.ok\)setFeedback/);
assert.match(app,/return true;/);
const followup=fs.readFileSync(new URL('../src/lib/confirmed-write-refresh.mjs',import.meta.url),'utf8');
assert.match(followup,/catch\(error\)/);
assert.match(followup,/reason:'incomplete'/);
// Staging workflow is explicitly manual, synthetic, read-only, and live-ref blocked.
const stage=fs.readFileSync(new URL('../scripts/staging-readonly-check.mjs',import.meta.url),'utf8');
const stageGuard=fs.readFileSync(new URL('../src/lib/staging-target-guard.mjs',import.meta.url),'utf8');
const stageYml=fs.readFileSync(new URL('../.github/workflows/staging-readonly-acceptance.yml',import.meta.url),'utf8');
assert.match(stage,/validateStagingReadOnlyTarget/);
assert.match(stage,/signInWithPassword/);
assert.match(stageGuard,/knownProductionRef='maqxyvqayilmibdrkmxu'/);
assert.doesNotMatch(stage,/\.insert\(|\.update\(|\.delete\(|\.upsert\(|v7_review_attendance/);
assert.match(stageYml,/workflow_dispatch:/);
assert.match(stageYml,/tags:\\s*\\n\\s*- 'v7-staging-check-\\*'/);
assert.doesNotMatch(stageYml,/\\n    branches:/);
assert.match(stageYml,/environment: v7-staging/);
console.log('Alpha47 follow-up refresh and staged Auth/RLS safety: source assertions PASS');
