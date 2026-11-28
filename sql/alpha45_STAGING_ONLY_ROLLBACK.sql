-- V7 Alpha45 | STAGING-ONLY rollback for alpha45_STAGING_ONLY_SAFE_MIGRATION.sql
-- This undoes only NEW Alpha45 schema objects; it does NOT delete business rows,
-- alter existing permissions/policies, or restore attendance entries. If real
-- business transactions were used in staging, discard/reset the staging project.
-- DO NOT EXECUTE AGAINST PRODUCTION.
begin;
drop index if exists public.v7_pending_student_day_unique;
drop function if exists public.v7_review_attendance(uuid,text,text);
drop function if exists public.v7_cadre_roster(uuid);
drop trigger if exists trg_v7_cadre_student_scope on public.cadre_submissions;
drop function if exists v7_private.assert_cadre_submission_student();
-- Deliberately NOT "cascade": refusal is safer than removing unknown dependencies.
drop schema if exists v7_private restrict;
commit;
