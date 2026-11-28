import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=name=>readFileSync(new URL('../sql/'+name,import.meta.url),'utf8');
test('Alpha45 preflight reports existing business constraints without exposing personal records',()=>{
 const s=sql('alpha45_PREFLIGHT_READONLY.sql');
 for(const check of ['attendance_unique_student_day','attendance_rls_enabled','cadre_submissions_rls_enabled','cadre_insert_policy_exists','teacher_submission_policy_exists','delegate_self_read_policy_exists','students_archive_column_exists','class_delegates_enabled_exists'])assert.ok(s.includes(check));
 assert.match(s,/to_regprocedure\('public\.v7_cadre_roster\(uuid\)'\)/);
 assert.match(s,/trg_v7_cadre_student_scope/);
 assert.doesNotMatch(s,/\b(insert\s+into|update\s+public\.|delete\s+from|drop\s+table|alter\s+table|create\s+policy)\b/i);
});
test('Alpha45 staged rollback removes only added interfaces, does not delete business records',()=>{
 const s=sql('alpha45_STAGING_ONLY_ROLLBACK.sql');
 assert.match(s,/STAGING-ONLY rollback/);
 assert.match(s,/drop function if exists public\.v7_cadre_roster/);
 assert.match(s,/drop function if exists public\.v7_review_attendance/);
 assert.match(s,/drop trigger if exists trg_v7_cadre_student_scope/);
 assert.match(s,/drop schema if exists v7_private restrict/);
 assert.doesNotMatch(s,/drop policy|truncate|delete from|drop table|cascade/i);
});
test('Alpha45 old Alpha9 policy-dropping migration is no longer executable',()=>{
 const old=sql('alpha9_PROPOSED_NOT_APPLIED.sql');
 assert.match(old,/DEPRECATED/);
 assert.match(old,/alpha45_STAGING_ONLY_SAFE_MIGRATION.sql/);
 const executable=old.split('\n').filter(line=>line.trim()&&!line.trim().startsWith('--'));
 assert.deepEqual(executable,[]);
});
