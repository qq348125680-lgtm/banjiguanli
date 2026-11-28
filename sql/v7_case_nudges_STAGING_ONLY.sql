-- STAGING ONLY: manual in-app case nudges, never SMS/WeChat/push.
-- Apply after v7_case_deadlines_STAGING_ONLY.sql and before any live migration.
begin;
create table public.v7_case_nudges(
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references public.v7_event_cases(id) on delete restrict,
 class_id uuid not null references public.classes(id),
 target_user_id uuid not null,
 actor_id uuid not null,
 note text not null check(char_length(btrim(note)) between 2 and 500),
 created_at timestamptz not null default now(),
 resolved_at timestamptz,
 resolved_reason text check(resolved_reason in ('已反馈','已转派','已结束')),
 constraint v7_case_nudge_resolved_consistent
  check((resolved_at is null)=(resolved_reason is null))
);
create unique index v7_case_one_active_nudge on public.v7_case_nudges(case_id)
 where resolved_at is null;
create index v7_case_nudge_inbox on public.v7_case_nudges(class_id,target_user_id,created_at desc)
 where resolved_at is null;
alter table public.v7_case_nudges enable row level security;
revoke all on public.v7_case_nudges from public,anon,authenticated;
grant select on public.v7_case_nudges to authenticated;
create policy v7_case_nudge_select on public.v7_case_nudges
 for select to authenticated using(
  exists(select 1 from public.classes c
   where c.id=v7_case_nudges.class_id and c.owner_id=(select auth.uid()))
  or (
   target_user_id=(select auth.uid())
   and exists(select 1 from public.v7_event_cases c
    where c.id=v7_case_nudges.case_id and c.class_id=v7_case_nudges.class_id
     and c.assigned_to=(select auth.uid()))
   and exists(select 1 from public.class_delegates d
    where d.class_id=v7_case_nudges.class_id and d.user_id=(select auth.uid()) and d.enabled=true)
  )
 );
alter table public.v7_event_case_history drop constraint v7_event_case_history_action_check;
alter table public.v7_event_case_history add constraint v7_event_case_history_action_check
 check(action in ('创建','指派','转派','反馈','结案','退回','设置期限','调整期限','取消期限','催办'));

create or replace function public.v7_send_case_nudge(p_case_id uuid,p_note text)
returns jsonb language plpgsql volatile security definer set search_path=''
as $fn$
declare v_actor uuid := (select auth.uid());
 v_case public.v7_event_cases%rowtype;
 v_now timestamptz := clock_timestamp();
 v_id uuid;
begin
 if v_actor is null or p_case_id is null or p_note is null
  or char_length(btrim(p_note)) not between 2 and 500
 then raise exception '催办需要2至500字具体说明' using errcode='22023';end if;
 select * into v_case from public.v7_event_cases where id=p_case_id for update;
 if not found then raise exception '工单不存在' using errcode='P0002';end if;
 if not exists(select 1 from public.classes c where c.id=v_case.class_id and c.owner_id=v_actor)
 then raise exception '仅班主任可发起催办' using errcode='42501';end if;
 if v_case.status<>'处理中' or v_case.assigned_to is null
  or v_case.due_on is null
  or v_case.due_on>(v_now at time zone 'Asia/Shanghai')::date
 then raise exception '仅能催办今天到期或逾期的已指派处理中工单' using errcode='23514';end if;
 if not exists(select 1 from public.classes c
  where c.id=v_case.class_id and c.owner_id=v_case.assigned_to)
  and not exists(select 1 from public.class_delegates d
   where d.class_id=v_case.class_id and d.user_id=v_case.assigned_to and d.enabled=true)
 then raise exception '原负责人已停用，请先转派' using errcode='23514';end if;
 if exists(select 1 from public.v7_case_nudges n
  where n.case_id=p_case_id
   and (n.created_at at time zone 'Asia/Shanghai')::date=
       (v_now at time zone 'Asia/Shanghai')::date)
 then raise exception '今天已催办过，请勿重复催办' using errcode='23514';end if;
 insert into public.v7_case_nudges(
  case_id,class_id,target_user_id,actor_id,note,created_at)
 values(p_case_id,v_case.class_id,v_case.assigned_to,v_actor,btrim(p_note),v_now)
 returning id into v_id;
 insert into public.v7_event_case_history(
  case_id,class_id,actor_id,action,from_status,to_status,note)
 values(p_case_id,v_case.class_id,v_actor,'催办',v_case.status,v_case.status,btrim(p_note));
 return jsonb_build_object('id',v_id,'case_id',p_case_id,'status','待反馈');
end;
$fn$;
revoke all on function public.v7_send_case_nudge(uuid,text) from public,anon,authenticated;
grant execute on function public.v7_send_case_nudge(uuid,text) to authenticated;

-- Existing reply transition remains the only authorized way to submit feedback.
-- Responding or transferring automatically resolves the pending in-app nudge,
-- preserving the original nudge record instead of deleting or rewriting it.
create or replace function public.v7_resolve_nudge_from_case()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare v_reason text;
begin
 if old.assigned_to is distinct from new.assigned_to then
  v_reason:='已转派';
 elsif old.status='处理中' and new.status<>'处理中' then
  v_reason:=case when new.status='待复核' then '已反馈' else '已结束' end;
 else
  return new;
 end if;
 update public.v7_case_nudges
 set resolved_at=clock_timestamp(),resolved_reason=v_reason
 where case_id=new.id and resolved_at is null;
 return new;
end;
$fn$;
revoke all on function public.v7_resolve_nudge_from_case() from public,anon,authenticated;
create trigger v7_case_resolve_nudge
 after update of status,assigned_to on public.v7_event_cases
 for each row execute function public.v7_resolve_nudge_from_case();
commit;
