-- V7 Event Cases v1: STAGING ONLY. Never run against a live school database.
-- Requires existing public.classes, students, class_delegates and auth.uid().
-- No modifications to existing attendance, class score, or contact rows.
begin;
create table public.v7_event_cases(
 id uuid primary key default gen_random_uuid(),
 request_key uuid not null,
 class_id uuid not null references public.classes(id),
 student_id uuid not null references public.students(id),
 kind text not null check(kind in ('考勤','请假','违纪','积分','值日','家校沟通','其他')),
 title text not null check(char_length(btrim(title)) between 2 and 80),
 description text not null default '' check(char_length(description)<=1000),
 status text not null default '待分派' check(status in ('待分派','处理中','待复核','已结案')),
 created_by uuid not null,
 assigned_to uuid,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 closed_at timestamptz,
 unique(class_id,request_key),
 constraint v7_case_closed_consistent check((status='已结案')=(closed_at is not null)),
 constraint v7_case_assignee_required check(status in ('待分派') or assigned_to is not null)
);
create index v7_event_cases_class_recent on public.v7_event_cases(class_id,created_at desc,id);
create index v7_event_cases_assignee_active on public.v7_event_cases(assigned_to,status) where status<>'已结案';
create table public.v7_event_case_history(
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references public.v7_event_cases(id) on delete restrict,
 class_id uuid not null references public.classes(id),
 actor_id uuid not null,
 action text not null check(action in ('创建','指派','反馈','结案','退回')),
 from_status text,
 to_status text not null,
 note text not null default '' check(char_length(note)<=1000),
 created_at timestamptz not null default now()
);
create index v7_event_history_case_time on public.v7_event_case_history(case_id,created_at,id);
alter table public.v7_event_cases enable row level security;
alter table public.v7_event_case_history enable row level security;
revoke all on public.v7_event_cases,public.v7_event_case_history from public,anon,authenticated;
grant select on public.v7_event_cases,public.v7_event_case_history to authenticated;
-- Nonowners see only their own or assigned cases, and only if still enabled.
create policy v7_event_case_select on public.v7_event_cases for select to authenticated using (
 exists(select 1 from public.classes c where c.id=class_id and c.owner_id=(select auth.uid()))
 or (
  ((select auth.uid())=created_by or (select auth.uid())=assigned_to)
  and exists(select 1 from public.class_delegates d where d.class_id=v7_event_cases.class_id
  and d.user_id=(select auth.uid()) and d.enabled=true)
 )
);
create policy v7_event_history_select on public.v7_event_case_history for select to authenticated using(
 exists(select 1 from public.v7_event_cases c where c.id=v7_event_case_history.case_id and c.class_id=v7_event_case_history.class_id)
);
-- No INSERT/UPDATE/DELETE grants on the tables. All transitions are atomic RPCs.
create or replace function public.v7_create_event_case(
 p_class_id uuid,p_student_id uuid,p_kind text,p_title text,p_description text,p_request_key uuid
) returns uuid language plpgsql volatile security definer set search_path=''
as $fn$
declare v_actor uuid := (select auth.uid()); v_id uuid; v_created int; v_existing public.v7_event_cases%rowtype;
begin
 if v_actor is null then raise exception '请先登录' using errcode='42501';end if;
 if p_class_id is null or p_student_id is null or p_request_key is null
  or p_kind not in ('考勤','请假','违纪','积分','值日','家校沟通','其他')
  or p_kind is null or p_title is null or char_length(btrim(p_title)) not between 2 and 80
  or char_length(coalesce(p_description,''))>1000 then
  raise exception '事件参数不合法' using errcode='22023';
 end if;
 if not exists(select 1 from public.classes c where c.id=p_class_id and c.owner_id=v_actor)
   and not exists(select 1 from public.class_delegates d
    where d.class_id=p_class_id and d.user_id=v_actor and d.enabled=true) then
  raise exception '没有当前班级操作权限' using errcode='42501';
 end if;
 if not exists(select 1 from public.students s where s.id=p_student_id and s.class_id=p_class_id and s.archived_at is null) then
  raise exception '学生不属于当前班级' using errcode='23514';
 end if;
 insert into public.v7_event_cases(request_key,class_id,student_id,kind,title,description,created_by)
 values(p_request_key,p_class_id,p_student_id,p_kind,btrim(p_title),btrim(coalesce(p_description,'')),v_actor)
 on conflict(class_id,request_key) do nothing returning id into v_id;
 get diagnostics v_created=row_count;
 if v_created=0 then
  select * into v_existing from public.v7_event_cases where class_id=p_class_id and request_key=p_request_key;
  if not found or v_existing.created_by<>v_actor or v_existing.student_id<>p_student_id
   or v_existing.kind<>p_kind or v_existing.title<>btrim(p_title)
   or v_existing.description<>btrim(coalesce(p_description,'')) then
   raise exception '事件请求编号重复或请求内容不同' using errcode='23505';
  end if;
  return v_existing.id;
 end if;
 insert into public.v7_event_case_history(case_id,class_id,actor_id,action,from_status,to_status,note)
 values(v_id,p_class_id,v_actor,'创建',null,'待分派','');
 return v_id;
end;
$fn$;
create or replace function public.v7_transition_event_case(
 p_case_id uuid,p_action text,p_assignee uuid default null,p_note text default ''
) returns jsonb language plpgsql volatile security definer set search_path=''
as $fn$
declare v_actor uuid := (select auth.uid());v_case public.v7_event_cases%rowtype;v_owner boolean;v_next text;v_name text;
begin
 if v_actor is null then raise exception '请先登录' using errcode='42501';end if;
 if p_case_id is null or p_action is null or p_action not in ('assign','reply','close','reopen')
   or char_length(coalesce(p_note,''))>1000 then raise exception '事件流转参数不合法' using errcode='22023';end if;
 select * into v_case from public.v7_event_cases where id=p_case_id for update;
 if not found then raise exception '事件不存在' using errcode='P0002';end if;
 select exists(select 1 from public.classes c where c.id=v_case.class_id and c.owner_id=v_actor) into v_owner;
 if not v_owner and not exists(select 1 from public.class_delegates d
  where d.class_id=v_case.class_id and d.user_id=v_actor and d.enabled=true
  and v_case.assigned_to=v_actor) then
  raise exception '没有当前工单操作权限' using errcode='42501';
 end if;
 if p_action='assign' then
  if not v_owner or v_case.status='已结案' or p_assignee is null then
   raise exception '只有班主任可以分派未结案工单' using errcode='42501';end if;
  if not exists(select 1 from public.classes c where c.id=v_case.class_id and c.owner_id=p_assignee)
   and not exists(select 1 from public.class_delegates d
    where d.class_id=v_case.class_id and d.user_id=p_assignee and d.enabled=true) then
   raise exception '负责人不属于当前授权班级' using errcode='23514';end if;
  v_next:='处理中';v_name:='指派';
  update public.v7_event_cases set assigned_to=p_assignee,status=v_next,updated_at=now(),closed_at=null where id=p_case_id;
 elsif p_action='reply' then
  if v_case.status<>'处理中' or v_case.assigned_to<>v_actor
   or nullif(btrim(coalesce(p_note,'')),'') is null then
   raise exception '仅当前负责人能在处理中提交有效反馈' using errcode='23514';end if;
  v_next:='待复核';v_name:='反馈';
  update public.v7_event_cases set status=v_next,updated_at=now() where id=p_case_id;
 elsif p_action='close' then
  if not v_owner or v_case.status<>'待复核' or nullif(btrim(coalesce(p_note,'')),'') is null then
   raise exception '仅班主任能复核并结案待复核工单' using errcode='23514';end if;
  v_next:='已结案';v_name:='结案';
  update public.v7_event_cases set status=v_next,closed_at=now(),updated_at=now() where id=p_case_id;
 else
  if not v_owner or v_case.status not in ('待复核','已结案')
   or nullif(btrim(coalesce(p_note,'')),'') is null then
   raise exception '仅班主任能退回待复核或已结案工单' using errcode='23514';end if;
  v_next:=case when v_case.assigned_to is null then '待分派' else '处理中' end;
  v_name:='退回';
  update public.v7_event_cases set status=v_next,closed_at=null,updated_at=now() where id=p_case_id;
 end if;
 insert into public.v7_event_case_history(case_id,class_id,actor_id,action,from_status,to_status,note)
 values(p_case_id,v_case.class_id,v_actor,v_name,v_case.status,v_next,btrim(coalesce(p_note,'')));
 return jsonb_build_object('id',p_case_id,'status',v_next,'action',v_name);
end;
$fn$;
revoke all on function public.v7_create_event_case(uuid,uuid,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.v7_transition_event_case(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.v7_create_event_case(uuid,uuid,text,text,text,uuid) to authenticated;
grant execute on function public.v7_transition_event_case(uuid,text,uuid,text) to authenticated;
commit;
