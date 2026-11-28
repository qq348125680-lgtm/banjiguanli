-- Alpha 9 REVIEW-ONLY migration. NOT EXECUTED against production.
-- Must first test against staging; backup database; validate two accounts and cross-class denial.
-- PostgreSQL 17 / Supabase. Never expose a service_role key to browser.
begin;

-- Minimal roster: returns only student identity, not phone, address, ID card or guardian info.
-- SECURITY DEFINER used only with strict auth + class membership checks below.
create or replace function public.v7_cadre_roster(p_class_id uuid)
returns table(student_id uuid, student_no text, student_name text)
language plpgsql stable security definer
set search_path = ''
as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null or p_class_id is null then
    raise exception '请登录后选择班级' using errcode='42501';
  end if;
  if not exists (
    select 1 from public.classes c where c.id=p_class_id and c.owner_id=v_uid
  ) and not exists (
    select 1 from public.class_delegates d
    where d.class_id=p_class_id and d.user_id=v_uid and d.enabled is true
  ) then
    raise exception '无权查看当前班级学生名单' using errcode='42501';
  end if;
  return query
    select s.id, s.student_no, s.name
    from public.students s where s.class_id=p_class_id and s.archived_at is null
    order by s.student_no nulls last, s.name
    limit 300;
end; $$;
revoke all on function public.v7_cadre_roster(uuid) from public, anon;
grant execute on function public.v7_cadre_roster(uuid) to authenticated;

-- Harden existing cadre submission insert: ensure student belongs to same class.
-- Preserve other existing restrictions; do not allow changing class, status or reviewer at insertion.
drop policy if exists submissions_cadre_insert on public.cadre_submissions;
create policy submissions_cadre_insert on public.cadre_submissions
for insert to authenticated
with check (
  submitted_by = (select auth.uid())
  and status='待审核' and reviewed_by is null and reviewed_at is null
  and entry_type in ('考勤','违纪','请假')
  and exists (select 1 from public.class_delegates d
    where d.class_id=cadre_submissions.class_id and d.user_id=(select auth.uid()) and d.enabled=true)
  and exists (select 1 from public.students s
    where s.id=cadre_submissions.student_id
      and s.class_id=cadre_submissions.class_id and s.archived_at is null)
);

-- Attendance review is atomic. For leave/incident approvals, use existing workflows until mapped.
-- The submission row is locked, previous decisions are rejected, and conflicting attendance is never overwritten.
create or replace function public.v7_review_attendance(
  p_submission_id uuid, p_action text, p_note text default ''
) returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.cadre_submissions%rowtype;
  v_status text;
  v_existing text;
  v_result text;
begin
  if v_uid is null then raise exception '请先登录' using errcode='42501'; end if;
  if p_submission_id is null or p_action not in ('approve','reject') then
    raise exception '无效审核参数' using errcode='22023';
  end if;
  if char_length(coalesce(p_note,''))>500 then
    raise exception '审核备注超过500字' using errcode='22023';
  end if;
  select * into v_row from public.cadre_submissions
    where id=p_submission_id for update;
  if not found then raise exception '事项不存在' using errcode='P0002'; end if;
  if not exists (select 1 from public.classes c
       where c.id=v_row.class_id and c.owner_id=v_uid) then
    raise exception '无审核权限' using errcode='42501';
  end if;
  if v_row.status <> '待审核' then
    raise exception '此事项已经审核，请刷新列表' using errcode='23505';
  end if;
  if not exists (select 1 from public.students s where s.id=v_row.student_id
    and s.class_id=v_row.class_id and s.archived_at is null) then
    raise exception '学生不属于当前班级或已归档' using errcode='23514';
  end if;
  if p_action='reject' then
    if nullif(btrim(coalesce(p_note,'')),'') is null then
      raise exception '驳回需要填写原因' using errcode='22023';
    end if;
    update public.cadre_submissions set status='已驳回',reviewed_by=v_uid,
      reviewed_at=now(),review_note=btrim(p_note) where id=v_row.id;
    return jsonb_build_object('id',v_row.id,'status','已驳回','posted',false);
  end if;
  if v_row.entry_type <> '考勤' then
    raise exception '该类型尚未启用原子化入账，请在旧版处理' using errcode='0A000';
  end if;
  v_status:=v_row.details->>'status';
  if v_status not in ('出勤','迟到','缺勤','事假','病假') or v_status is null then
    raise exception '考勤状态格式不正确' using errcode='22023';
  end if;
  -- Never silently approve a second submission for an already recorded day.
  -- A UNIQUE(student_id,on_date) constraint serializes concurrent inserts.
  -- If an existing row has the same status, we still reject the new approval:
  -- this prevents two separately approved submissions from claiming one attendance row.
  insert into public.attendance(student_id,on_date,status,note)
    values(v_row.student_id,v_row.occurred_on,v_status,
           left(coalesce(v_row.details->>'note',''),500));
  v_existing:=v_status;
  update public.cadre_submissions set status='已通过',reviewed_by=v_uid,
    reviewed_at=now(),review_note=coalesce(p_note,'') where id=v_row.id;
  return jsonb_build_object('id',v_row.id,'status','已通过',
                            'posted',true,'attendance_status',v_existing);
end; $$;
revoke all on function public.v7_review_attendance(uuid,text,text) from public, anon;
grant execute on function public.v7_review_attendance(uuid,text,text) to authenticated;
commit;
