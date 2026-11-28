-- Disposable PG17: owner deadlines, stale-write rejection, reporting and privacy.
\set ON_ERROR_STOP on
begin;
set local role authenticated;
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $$
declare v uuid;v_closed uuid;n int;sum bigint;
begin
 select id into v from public.v7_event_cases
 where request_key='77777777-7777-4777-8777-777777777777';
 if v is null then raise exception 'missing base workflow case';end if;
 perform public.v7_set_case_deadline(v,'2026-12-05'::date,null,'本周内完成师生谈话');
 select count(*) into n from public.v7_event_case_history
 where case_id=v and action='设置期限' and previous_due_on is null
 and next_due_on='2026-12-05'::date;
 if n<>1 then raise exception 'initial deadline not audited';end if;
 begin
  perform public.v7_set_case_deadline(v,'2026-12-07'::date,null,'未经刷新');
  raise exception 'stale deadline overwrote another update';
 exception when check_violation then null;end;
 begin
  perform public.v7_set_case_deadline(v,'2026-12-05'::date,'2026-12-05'::date,'原日期未变');
  raise exception 'unchanged deadline accepted';
 exception when check_violation then null;end;
 begin
  perform public.v7_set_case_deadline(v,'2026-12-08'::date,'2026-12-05'::date,'');
  raise exception 'missing change reason accepted';
 exception when invalid_parameter_value then null;end;
 perform public.v7_set_case_deadline(v,'2026-12-08'::date,'2026-12-05'::date,'期末考试安排调整');
 select count(*) into n from public.v7_event_case_history where case_id=v
 and action='调整期限' and previous_due_on='2026-12-05'::date
 and next_due_on='2026-12-08'::date and note='期末考试安排调整';
 if n<>1 then raise exception 'deadline change history lacks old/new dates';end if;
 perform public.v7_set_case_deadline(v,null,'2026-12-08'::date,'事项已经暂停跟进');
 select count(*) into n from public.v7_event_case_history where case_id=v
 and action='取消期限' and previous_due_on='2026-12-08'::date and next_due_on is null;
 if n<>1 then raise exception 'deadline cancel not audited';end if;
 perform public.v7_set_case_deadline(v,'2026-11-20'::date,null,'回访截止日用于逾期提醒测试');
 v_closed:=public.v7_create_event_case(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000002',
  '值日','已结案卫生回访','用于关闭提醒测试',
  'dbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
 perform public.v7_transition_event_case(v_closed,'assign','11111111-1111-4111-8111-111111111111','');
 perform public.v7_set_case_deadline(v_closed,'2026-11-20'::date,null,'结案前处理截止日');
 perform public.v7_transition_event_case(v_closed,'reply',null,'已完成现场核对');
 perform public.v7_transition_event_case(v_closed,'close',null,'班主任复核结束');
 begin
  perform public.v7_set_case_deadline(v_closed,'2026-12-30'::date,'2026-11-20'::date,'不应修改');
  raise exception 'closed case deadline changed';
 exception when check_violation then null;end;
 select sum(amount) into sum from public.v7_class_case_overview('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') where dimension='status';
 if sum<>2 then raise exception 'class status overview should cover two cases, got %',sum;end if;
 select sum(amount) into sum from public.v7_class_case_overview('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') where dimension='kind';
 if sum<>2 then raise exception 'class kind overview should cover two cases, got %',sum;end if;
 select sum(amount) into sum from public.v7_class_case_overview('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') where dimension='assignee';
 if sum<>1 then raise exception 'open assignee overview should exclude closed case, got %',sum;end if;
end$$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
do $$
declare v uuid;
begin
 select id into v from public.v7_event_cases
 where request_key='77777777-7777-4777-8777-777777777777';
 begin
  perform public.v7_set_case_deadline(v,'2026-12-20'::date,'2026-11-20'::date,'干部越权修改');
  raise exception 'delegate modified deadline';
 exception when insufficient_privilege then null;end;
 begin
  perform * from public.v7_class_case_overview('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  raise exception 'delegate enumerated all class workload';
 exception when insufficient_privilege then null;end;
end$$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
do $$
begin
 begin
  perform * from public.v7_class_case_overview('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  raise exception 'cross-class workload leaked';
 exception when insufficient_privilege then null;end;
end$$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $$
begin
 begin
  update public.v7_event_cases set due_on='2027-01-01';
  raise exception 'browser direct update to deadline unexpectedly allowed';
 exception when insufficient_privilege then null;end;
 begin
  delete from public.v7_event_case_history where action='设置期限';
  raise exception 'browser deleted deadline audit';
 exception when insufficient_privilege then null;end;
end$$;
commit;
begin;
set local role anon;
do $$
begin
 begin
  perform public.v7_set_case_deadline(null,null,null,null);
  raise exception 'anon can call deadline function';
 exception when insufficient_privilege then null;end;
end$$;
commit;
