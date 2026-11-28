import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const component=readFileSync(new URL('../src/components/EntryProgress.tsx',import.meta.url),'utf8');
test('student panel is actually extracted and imported',()=>{assert.match(app,/import \{StudentsPanel\}/);assert.match(app,/<StudentsPanel students=/)});
test('progress is session-scoped and resets for class, date, and login user',()=>{assert.match(app,/setSubmittedSession\(\[\]\)/);assert.match(app,/\[classId,day,user\?\.id\]/)});
test('duplicate same-session submission blocked at UI and extracted component',()=>{const entry=readFileSync(new URL('../src/components/AttendanceEntryPanel.tsx',import.meta.url),'utf8');assert.match(app,/submittedSession\.includes\(selected\)/);assert.match(entry,/!p\.completed\.includes\(p\.selected\)/)});
test('progress is not asserted as formal attendance',()=>assert.match(component,/不是实际出勤统计/));
