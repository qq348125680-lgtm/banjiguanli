-- STAGING ONLY. Run AFTER v7_event_cases_STAGING_ONLY.sql in disposable PG17.
-- School-specific deadline is a calendar date in Asia/Shanghai (not UTC midnight).
begin;
alter table public.v7_event_cases add column due_on date;
create index v7_event_cases_open_due_idx on public.v7_event_cases(class_id,due_on,id)
 where due_on is not null and status <> '已结案';
alter table public.v7_event_case_history
 add column previous_due_on date,
 add column next_due_on date;
alter table public.v7_event_case_history drop constraint v7_event_case_history_action_check;
alter table public.v7_event_case_history add constraint v7_event_case_history_action_check
 check(action in ('创建','指派','转派','反馈','结案','退回','设置期限','调整期限','取消期限'));

create or replace function public.v7_set_case_deadline(
 p_case_id uuid,p_due_on date,p_expected_due_on date,p_note text
) returns jsonb language plpgsql volatile security definer set search_path=''
as $fn$
declare v_actor uuid := (select auth.uid());
 v_case public.v7_event_cases%rowtype;v_action text;
begin
 if v_actor is null or p_case_id is null
  or p_note is null or char_length(btrim(p_note)) not between 2 and 500
 then raise exception '处理期限变更必须填写理由（2-500字）' using errcode='22023';end if;
 select * into v_case from public.v7_event_cases where id=p_case_id for update;
 if not found then raise exception '事件工单不存在' using errcode='P0002';end if;
 if not exists(select 1 from public.classes c where c.id=v_case.class_id and c.owner_id=v_actor)
 then raise exception '只有本班班主任可设定处理期限' using errcode='42501';end if;
 if v_case.status='已结案' then
  raise exception '已结案工单不可修改期限' using errcode='23514';end if;
 if v_case.due_on is distinct from p_expected_due_on then
  raise exception '期限已被其他操作修改，请刷新后再提交' using errcode='23514';end if;
 if v_case.due_on is not distinct from p_due_on then
  raise exception '处理期限未发生变化' using errcode='23514';end if;
 v_action:=case when p_due_on is null then '取消期限'
  when v_case.due_on is null then '设置期限' else '调整期限' end;
 update public.v7_event_cases set due_on=p_due_on,updated_at=now() where id=p_case_id;
 insert into public.v7_event_case_history(
  case_id,class_id,actor_id,action,from_status,to_status,note,previous_due_on,next_due_on)
 values(p_case_id,v_case.class_id,v_actor,v_action,v_case.status,v_case.status,
  btrim(p_note),v_case.due_on,p_due_on);
 return jsonb_build_object('id',p_case_id,'status',v_case.status,'due_on',p_due_on,'action',v_action);
end;
$fn$;
revoke all on function public.v7_set_case_deadline(uuid,date,date,text) from public,anon,authenticated;
grant execute on function public.v7_set_case_deadline(uuid,date,date,text) to authenticated;

-- Owner-only overview: status, category and outstanding work by responsible UID.
-- No student IDs, case descriptions, guardian details or phone numbers returned.
create or replace function public.v7_class_case_overview(p_class_id uuid)
returns table(dimension text,item text,amount bigint)
language plpgsql stable security definer set search_path=''
as $fn$
declare v_actor uuid := (select auth.uid());
begin
 if v_actor is null or p_class_id is null
  or not exists(select 1 from public.classes c where c.id=p_class_id and c.owner_id=v_actor)
 then raise exception '只有本班班主任可查看工单汇总' using errcode='42501';end if;
 return query
  select 'status'::text,c.status::text,count(*)::bigint
   from public.v7_event_cases c where c.class_id=p_class_id group by c.status
  union all
  select 'kind'::text,c.kind::text,count(*)::bigint
   from public.v7_event_cases c where c.class_id=p_class_id group by c.kind
  union all
  select 'assignee'::text,c.assigned_to::text,count(*)::bigint
   from public.v7_event_cases c
   where c.class_id=p_class_id and c.status<>'已结案' and c.assigned_to is not null
   group by c.assigned_to
  order by 1,2;
end;
$fn$;
revoke all on function public.v7_class_case_overview(uuid) from public,anon,authenticated;
grant execute on function public.v7_class_case_overview(uuid) to authenticated;
commit;
