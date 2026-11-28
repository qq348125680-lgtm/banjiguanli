-- V7 Alpha45 | STAGING ONLY, NOT APPLIED TO THE LIVE SUPABASE PROJECT
-- Prerequisites: restore a recent sanitized snapshot to a disposable test project;
-- verify the real DDL, current RLS policies and attendance UNIQUE(student_id,on_date).
-- Do not run this in the school production project before two-account RLS acceptance.
-- This script deliberately leaves the existing cadre INSERT policy in place.
begin;

-- A private trigger guarantees student/class consistency at the database level.
-- A restrictive INSERT policy alone is NOT sufficient in this current schema:
-- delegates lack direct SELECT access to students, so nested RLS can reject valid inserts.
create schema if not exists v7_private;
revoke all on schema v7_private from public, anon, authenticated;

create or replace function v7_private.assert_cadre_submission_student()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if not exists (
    select 1 from public.students s
    where s.id = new.student_id and s.class_id = new.class_id
      and s.archived_at is null
  ) then
    raise exception '学生不属于当前班级或已归档'
      using errcode = '23514';
  end if;
  return new;
end;
$fn$;
revoke all on function v7_private.assert_cadre_submission_student() from public, anon, authenticated;
drop trigger if exists trg_v7_cadre_student_scope on public.cadre_submissions;
create trigger trg_v7_cadre_student_scope
before insert or update of student_id, class_id
on public.cadre_submissions
for each row execute function v7_private.assert_cadre_submission_student();

-- This RPC reveals only the current owner's/delegate's limited roster.
-- The function is SECURITY DEFINER because delegates do not have direct
-- students SELECT RLS; this is an explicitly reviewed least-privilege exception.
create or replace function public.v7_cadre_roster(p_class_id uuid)
returns table(student_id uuid,student_no text,student_name text)
language plpgsql stable security definer
set search_path=''
as $fn$
declare v_uid uuid := (select auth.uid());
begin
 if v_uid is null or p_class_id is null then
   raise exception '请先登录并选择班级' using errcode='42501';
 end if;
 if not exists (select 1 from public.classes c where c.id=p_class_id and c.owner_id=v_uid)
    and not exists (
      select 1 from public.class_delegates d
      where d.class_id=p_class_id and d.user_id=v_uid and d.enabled is true
    ) then
   raise exception '当前账号没有班级花名册权限' using errcode='42501';
 end if;
 return query
   select s.id,s.student_no,s.name from public.students s
    where s.class_id=p_class_id and s.archived_at is null
    order by s.student_no nulls last,s.name limit 300;
end;
$fn$;
revoke all on function public.v7_cadre_roster(uuid) from public, anon, authenticated;
grant execute on function public.v7_cadre_roster(uuid) to authenticated;

-- Atomic review: SELECT FOR UPDATE locks the submission and either attendance
-- plus approval commit together, or neither does. Duplicate date violates the
-- already confirmed UNIQUE(attendance.student_id,attendance.on_date) constraint.
create or replace function public.v7_review_attendance(
 p_submission_id uuid,p_action text,p_note text default ''
) returns jsonb
language plpgsql volatile security definer
set search_path=''
as $fn$
declare
 v_uid uuid := (select auth.uid());
 v_row public.cadre_submissions%rowtype;
 v_status text;
begin
 if v_uid is null then raise exception '请先登录' using errcode='42501'; end if;
 if p_submission_id is null or p_action is null or p_action not in ('approve','reject') then
   raise exception '审核参数无效' using errcode='22023';
 end if;
 if char_length(coalesce(p_note,''))>500 then
   raise exception '审核备注超过500字' using errcode='22023';
 end if;
 select * into v_row
   from public.cadre_submissions where id=p_submission_id for update;
 if not found then raise exception '申请不存在' using errcode='P0002'; end if;
 if not exists (select 1 from public.classes c
    where c.id=v_row.class_id and c.owner_id=v_uid) then
   raise exception '当前账号无审核权限' using errcode='42501';
 end if;
 if v_row.status <> '待审核' then
   raise exception '此申请已被处理，请刷新后核对' using errcode='23505';
 end if;
 if v_row.entry_type <> '考勤' then
   raise exception '该申请类型尚未开放 V7 审核' using errcode='0A000';
 end if;
 if not exists (select 1 from public.students s
    where s.id=v_row.student_id and s.class_id=v_row.class_id
      and s.archived_at is null) then
   raise exception '学生不属于当前班级或已归档' using errcode='23514';
 end if;
 if p_action='reject' then
   if nullif(btrim(coalesce(p_note,'')),'') is null then
     raise exception '驳回必须写明原因' using errcode='22023';
   end if;
   update public.cadre_submissions set status='已驳回',
     reviewed_by=v_uid,reviewed_at=now(),review_note=btrim(p_note)
     where id=v_row.id;
   return jsonb_build_object('id',v_row.id,'status','已驳回','posted',false);
 end if;
 v_status := v_row.details->>'status';
 if v_status is null or v_status not in ('出勤','迟到','缺勤','事假','病假') then
   raise exception '考勤状态缺失或不合法' using errcode='22023';
 end if;
 insert into public.attendance(student_id,on_date,status,note)
   values(v_row.student_id,v_row.occurred_on,v_status,
     left(coalesce(v_row.details->>'note',''),500));
 update public.cadre_submissions set status='已通过',reviewed_by=v_uid,
   reviewed_at=now(),review_note=btrim(coalesce(p_note,''))
   where id=v_row.id;
 return jsonb_build_object('id',v_row.id,'status','已通过',
   'posted',true,'attendance_status',v_status);
end;
$fn$;
revoke all on function public.v7_review_attendance(uuid,text,text) from public, anon, authenticated;
grant execute on function public.v7_review_attendance(uuid,text,text) to authenticated;
commit;

-- Staging-only acceptance after deployment (not automatic):
-- 1. Delegated user sees only own class, never another class or archived student;
-- 2. Disabled delegated user cannot read roster or insert submissions;
-- 3. Cross-class student INSERT rejected by trigger (23514) even if RLS allowed row;
-- 4. Only class owner can approve/reject, no re-review after first decision;
-- 5. Concurrent approvals for one student/day produce ONE attendance row and
--    only ONE approved submission; losing transaction is rolled back;
-- 6. Broken/unknown details and wrong entry types never change attendance;
-- 7. Run Supabase security advisors and verify only intended RPC EXECUTE grants.
-- 8. Snapshot restore drill completed before considering production rollout.
