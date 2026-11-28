-- V7 weekly case activity report. STAGING ONLY: apply to disposable PG17.
-- Read-only aggregate. Never edits school attendance, family records or event history.
begin;
create or replace function public.v7_weekly_case_report(p_class_id uuid,p_week_start date)
returns table(metric text,item text,amount bigint)
language plpgsql stable security definer set search_path=''
as $fn$
declare v_actor uuid := (select auth.uid());v_from timestamptz;v_until timestamptz;
begin
 if v_actor is null or p_class_id is null
  or not exists(select 1 from public.classes c where c.id=p_class_id and c.owner_id=v_actor)
 then raise exception '只有当前班主任可以生成全班周报' using errcode='42501';end if;
 if p_week_start is null or extract(isodow from p_week_start)<>1
 then raise exception '周报起始日期必须为星期一' using errcode='22023';end if;
 v_from:=p_week_start::timestamp at time zone 'Asia/Shanghai';
 v_until:=(p_week_start+7)::timestamp at time zone 'Asia/Shanghai';
 return query
  select 'created'::text,c.kind::text,count(*)::bigint
   from public.v7_event_cases c
   where c.class_id=p_class_id and c.created_at>=v_from and c.created_at<v_until
   group by c.kind
  union all
  select 'action'::text,h.action::text,count(*)::bigint
   from public.v7_event_case_history h
   where h.class_id=p_class_id and h.created_at>=v_from and h.created_at<v_until
   group by h.action
  union all
  select 'closed'::text,c.kind::text,count(*)::bigint
   from public.v7_event_case_history h
   join public.v7_event_cases c on c.id=h.case_id and c.class_id=h.class_id
   where h.class_id=p_class_id and h.action='结案'
     and h.created_at>=v_from and h.created_at<v_until
   group by c.kind
  order by 1,2;
end;
$fn$;
revoke all on function public.v7_weekly_case_report(uuid,date) from public,anon,authenticated;
grant execute on function public.v7_weekly_case_report(uuid,date) to authenticated;
commit;
