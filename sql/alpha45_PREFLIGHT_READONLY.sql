-- V7 Alpha45 schema preflight; READ-ONLY, no personal records, no mutations.
-- Run against a STAGING snapshot. Live project may be examined read-only for
-- a comparison of names/constraints, but NEVER execute the staging migration live.
-- Every check MUST be true except the last two, which should be false before install.
select
 'attendance_unique_student_day' as check_name,
 exists(
  select 1 from pg_constraint c where c.conrelid='public.attendance'::regclass
    and c.contype='u' and
      pg_get_constraintdef(c.oid) ~* 'UNIQUE \\(student_id, on_date\\)'
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

-- Post-migration checks: expect true ONLY after staging migration.
select 'roster_function_installed' as check_name,
 to_regprocedure('public.v7_cadre_roster(uuid)') is not null as installed
union all
select 'review_function_installed',
 to_regprocedure('public.v7_review_attendance(uuid,text,text)') is not null
union all
select 'student_scope_trigger_installed',exists(
 select 1 from pg_trigger
 where tgrelid='public.cadre_submissions'::regclass
 and tgname='trg_v7_cadre_student_scope' and not tgisinternal
);
