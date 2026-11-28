-- V7 Alpha45 schema preflight; READ-ONLY, no personal records, no mutations.
-- Run against a STAGING snapshot. Live project may be examined read-only for
-- a comparison of names/constraints, but NEVER execute the staging migration live.
-- All eight schema/policy checks should be true. The three installed flags below\n-- should be false before migration and true after successful staging installation.
select
 'attendance_unique_student_day' as check_name,
 exists(
  select 1 from pg_constraint c where c.conrelid='public.attendance'::regclass
    and c.contype='u' and
      position('UNIQUE (student_id, on_date)' in pg_get_constraintdef(c.oid)) > 0
 ) as pass
union all
select 'attendance_rls_enabled',coalesce((select relrowsecurity from pg_class where oid='public.attendance'::regclass),false)
union all
select 'cadre_submissions_rls_enabled',coalesce((select relrowsecurity from pg_class where oid='public.cadre_submissions'::regclass),false)
union all
select 'cadre_insert_policy_exists',exists(
 select 1 from pg_policies where schemaname='public'
 and tablename='cadre_submissions' and policyname='submissions_cadre_insert'
 and cmd='INSERT'
)
union all
select 'teacher_submission_policy_exists',exists(
 select 1 from pg_policies where schemaname='public'
 and tablename='cadre_submissions' and policyname='submissions_teacher'
)
union all
select 'delegate_self_read_policy_exists',exists(
 select 1 from pg_policies where schemaname='public'
 and tablename='class_delegates' and policyname='delegates_self_read'
)
union all
select 'students_archive_column_exists',exists(
 select 1 from information_schema.columns where table_schema='public'
 and table_name='students' and column_name='archived_at'
)
union all
select 'class_delegates_enabled_exists',exists(
 select 1 from information_schema.columns where table_schema='public'
 and table_name='class_delegates' and column_name='enabled'
)
order by check_name;

-- Aggregate-only check: duplicate pending ATTENDANCE groups must be ZERO before installing
-- the partial unique index. No student identity leaves the database.
select count(*)::integer as duplicate_pending_groups
from (
 select class_id,student_id,entry_type,occurred_on
 from public.cadre_submissions where status='待审核' and entry_type='考勤'
 group by class_id,student_id,occurred_on having count(*)>1
) duplicate_groups;

-- Post-migration checks: expect true ONLY after staging migration.
select 'roster_function_installed' as check_name,
 to_regprocedure('public.v7_cadre_roster(uuid)') is not null as installed
union all
select 'review_function_installed',
 to_regprocedure('public.v7_review_attendance(uuid,text,text)') is not null
union all
select 'pending_unique_index_installed',to_regclass('public.v7_pending_student_day_unique') is not null
union all
select 'student_scope_trigger_installed',exists(
 select 1 from pg_trigger
 where tgrelid='public.cadre_submissions'::regclass
 and tgname='trg_v7_cadre_student_scope' and not tgisinternal
);
