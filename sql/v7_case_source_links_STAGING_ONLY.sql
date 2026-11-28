-- V7 Event ↔ Existing Class Record v1: STAGING ONLY. Never run on school production.
-- Execute AFTER sql/v7_event_cases_STAGING_ONLY.sql, against existing six business tables.
-- Owner-only mapping stores source IDs; does NOT copy family contact content.
begin;
create table public.v7_event_case_sources(
 case_id uuid primary key references public.v7_event_cases(id) on delete restrict,
 class_id uuid not null references public.classes(id),
 student_id uuid not null references public.students(id),
 source_kind text not null check(source_kind in ('考勤','请假','违纪','积分','值日','家校沟通')),
 source_record_id uuid not null,
 linked_by uuid not null,
 linked_at timestamptz not null default now(),
 unique(class_id,source_kind,source_record_id)
);
create index v7_event_source_student on public.v7_event_case_sources(class_id,student_id,linked_at desc);
alter table public.v7_event_case_sources enable row level security;
revoke all on public.v7_event_case_sources from public,anon,authenticated;
grant select on public.v7_event_case_sources to authenticated;
-- Source record identifiers are teacher-only; assigned delegates see only case
-- tasks, not the family contact source IDs or raw family contact row.
create policy v7_event_source_teacher on public.v7_event_case_sources
 for select to authenticated using (
  exists(select 1 from public.classes c
   where c.id=v7_event_case_sources.class_id and c.owner_id=(select auth.uid()))
 );
-- Create linked case and source pointer in ONE DB transaction. Any failure
-- rolls both writes back. The original legacy business record is never edited.
create or replace function public.v7_create_linked_event_case(
 p_class_id uuid,p_student_id uuid,p_kind text,p_title text,p_description text,
 p_request_key uuid,p_source_record_id uuid
) returns uuid language plpgsql volatile security definer set search_path=''
as $fn$
declare v_actor uuid := (select auth.uid());v_table text;v_valid boolean;v_case uuid;v_link public.v7_event_case_sources%rowtype;
begin
 if v_actor is null or p_class_id is null or not exists(
  select 1 from public.classes c where c.id=p_class_id and c.owner_id=v_actor)
 then raise exception '只有本班班主任可关联原始业务记录' using errcode='42501';end if;
 if p_student_id is null or p_source_record_id is null or p_kind is null then
  raise exception '原始业务记录关联参数不完整' using errcode='22023';end if;
 v_table:=case p_kind
  when '考勤' then 'attendance'
  when '请假' then 'leave_requests'
  when '违纪' then 'incidents'
  when '积分' then 'point_events'
  when '值日' then 'duty_assignments'
  when '家校沟通' then 'family_contacts'
  else null end;
 if v_table is null then raise exception '不支持关联该业务类型' using errcode='22023';end if;
 if not exists(select 1 from public.students s where s.id=p_student_id
  and s.class_id=p_class_id and s.archived_at is null) then
  raise exception '指定学生不是本班在读学生' using errcode='23514';end if;
 -- Fixed allowlisted table name; UUIDs remain bind parameters (no user SQL).
 if p_kind='值日' then
  execute format('select exists(select 1 from public.%I where id=$1 and student_id=$2 and class_id=$3)',v_table)
   into v_valid using p_source_record_id,p_student_id,p_class_id;
 else
  execute format('select exists(select 1 from public.%I where id=$1 and student_id=$2)',v_table)
   into v_valid using p_source_record_id,p_student_id;
 end if;
 if not coalesce(v_valid,false) then
  raise exception '原记录不存在或不属于该学生' using errcode='23514';end if;
 -- The unique request key is shared with regular case creation, so retries
 -- with the same payload resolve to the same case.
 v_case:=public.v7_create_event_case(
  p_class_id,p_student_id,p_kind,p_title,p_description,p_request_key);
 insert into public.v7_event_case_sources(case_id,class_id,student_id,source_kind,source_record_id,linked_by)
 values(v_case,p_class_id,p_student_id,p_kind,p_source_record_id,v_actor)
 on conflict do nothing;
 select * into v_link from public.v7_event_case_sources where case_id=v_case;
 if not found or v_link.class_id<>p_class_id or v_link.student_id<>p_student_id
  or v_link.source_kind<>p_kind or v_link.source_record_id<>p_source_record_id
  or v_link.linked_by<>v_actor then
  raise exception '此工单已经关联其他原始记录，或原记录已用于另一工单' using errcode='23505';
 end if;
 return v_case;
end;
$fn$;
revoke all on function public.v7_create_linked_event_case(uuid,uuid,text,text,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.v7_create_linked_event_case(uuid,uuid,text,text,text,uuid,uuid) to authenticated;
commit;
