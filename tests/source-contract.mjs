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
