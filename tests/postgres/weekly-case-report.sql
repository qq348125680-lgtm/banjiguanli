-- V7 weekly report contract: real temporary PostgreSQL17 with synthetic cases only.
\set ON_ERROR_STOP on
begin;
set local role authenticated;
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $$
declare wk date;from_ts timestamptz;to_ts timestamptz;created bigint;audited bigint;
  closed bigint;closed_history bigint;report_created bigint;report_closed bigint;
  family_report bigint;family_actual bigint;
begin
 wk:=date_trunc('week',(now() at time zone 'Asia/Shanghai'))::date;
 from_ts:=wk::timestamp at time zone 'Asia/Shanghai';
 to_ts:=(wk+7)::timestamp at time zone 'Asia/Shanghai';
 select count(*) into created from public.v7_event_cases
  where class_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
   and created_at>=from_ts and created_at<to_ts;
 select count(*) into audited from public.v7_event_case_history
  where class_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
   and action='创建' and created_at>=from_ts and created_at<to_ts;
 if created<>audited or created<2 then
  raise exception 'synthetic created event/historical operation mismatch % / %',created,audited;end if;
 select coalesce(sum(amount),0) into report_created
  from public.v7_weekly_case_report('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',wk)
  where metric='created';
 if report_created<>created then raise exception 'weekly created category totals mismatch, got % expected %',report_created,created;end if;
 select coalesce(sum(amount),0) into report_created
  from public.v7_weekly_case_report('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',wk)
  where metric='action' and item='创建';
 if report_created<>created then raise exception 'weekly creation audit differs from cases';end if;
 select count(*) into closed_history from public.v7_event_case_history
  where class_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
   and action='结案' and created_at>=from_ts and created_at<to_ts;
 select coalesce(sum(amount),0) into report_closed
  from public.v7_weekly_case_report('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',wk)
  where metric='closed';
 if report_closed<>closed_history or closed_history<1 then
  raise exception 'weekly closure actions incorrect, got % expected %',report_closed,closed_history;end if;
 select coalesce(sum(amount),0) into family_report
  from public.v7_weekly_case_report('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',wk)
  where metric='created' and item='家校沟通';
 select count(*) into family_actual from public.v7_event_cases
  where class_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
   and kind='家校沟通' and created_at>=from_ts and created_at<to_ts;
 if family_actual<>family_report or family_actual<1 then
  raise exception 'family follow-up total incorrect';end if;
 if exists(select 1 from public.v7_weekly_case_report('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',wk-7))
 then raise exception 'previous empty synthetic week reported invented events';end if;
 begin
  perform * from public.v7_weekly_case_report('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',wk+1);
  raise exception 'non-Monday accepted as weekly starting date';
 exception when invalid_parameter_value then null;end;
end$$;
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
do $$
declare wk date;
begin
 wk:=date_trunc('week',(now() at time zone 'Asia/Shanghai'))::date;
 begin
  perform * from public.v7_weekly_case_report('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',wk);
  raise exception 'cadre accessed complete class weekly report';
 exception when insufficient_privilege then null;end;
end$$;
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
do $$
declare wk date;
begin
 wk:=date_trunc('week',(now() at time zone 'Asia/Shanghai'))::date;
 begin
  perform * from public.v7_weekly_case_report('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',wk);
  raise exception 'cross-class owner accessed unrelated weekly report';
 exception when insufficient_privilege then null;end;
end$$;
commit;
begin;
set local role anon;
do $$
begin
 begin
  perform * from public.v7_weekly_case_report(null,null);
  raise exception 'anonymous weekly report call allowed';
 exception when insufficient_privilege then null;end;
end$$;
commit;
