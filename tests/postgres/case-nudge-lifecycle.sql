-- Disposable PostgreSQL17 only. Synthetic school case with a due date in the past.
\set ON_ERROR_STOP on
begin;
set local role authenticated;
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $$
declare c uuid;n uuid;n2 uuid;closed_case uuid;cnt int;
begin
 select id into c from public.v7_event_cases
  where request_key='77777777-7777-4777-8777-777777777777';
 if c is null then raise exception 'missing fake assigned case';end if;
 n:=(public.v7_send_case_nudge(c,'请于今日完成核实，并提交书面反馈')->>'id')::uuid;
 select count(*) into cnt from public.v7_case_nudges
  where id=n and case_id=c and resolved_at is null
  and target_user_id='33333333-3333-4333-8333-333333333333';
 if cnt<>1 then raise exception 'nudge was not assigned to current owner-approved cadre';end if;
 select count(*) into cnt from public.v7_event_case_history
  where case_id=c and action='催办' and actor_id='11111111-1111-4111-8111-111111111111';
 if cnt<>1 then raise exception 'nudge missing in immutable action history';end if;
 begin
  perform public.v7_send_case_nudge(c,'再次催办，不应重复');
  raise exception 'same-day repeated nudge allowed';
 exception when check_violation then null;end;
 select id into closed_case from public.v7_event_cases
  where request_key='dbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 begin
  perform public.v7_send_case_nudge(closed_case,'已结案工单仍然催办');
  raise exception 'closed case can be nudged';
 exception when check_violation then null;end;
 begin
  perform public.v7_send_case_nudge(c,'x');
  raise exception 'single-character nudge accepted';
 exception when invalid_parameter_value then null;end;
 select count(*) into cnt from public.v7_case_nudges where case_id=c;
 if cnt<>1 then raise exception 'duplicate nudge slipped into persistence';end if;
end$$;
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub='66666666-6666-4666-8666-666666666666';
do $$
declare cnt int;
begin
 select count(*) into cnt from public.v7_case_nudges;
 if cnt<>0 then raise exception 'non-assignee cadre could read another nudge';end if;
end$$;
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
do $$
declare c uuid;cnt int;
begin
 select count(*) into cnt from public.v7_case_nudges where resolved_at is null;
 if cnt<>1 then raise exception 'assigned cadre cannot see pending nudge';end if;
 select id into c from public.v7_event_cases
  where request_key='77777777-7777-4777-8777-777777777777';
 begin
  perform public.v7_send_case_nudge(c,'干部不能催办别人');
  raise exception 'cadre could send owner-only nudge';
 exception when insufficient_privilege then null;end;
 perform public.v7_transition_event_case(c,'reply',null,'催办已收到，已完成教育谈话并提交班主任复核');
 select count(*) into cnt from public.v7_case_nudges
  where case_id=c and resolved_at is not null and resolved_reason='已反馈';
 if cnt<>1 then raise exception 'cadre feedback did not resolve their pending nudge';end if;
 select count(*) into cnt from public.v7_case_nudges where resolved_at is null;
 if cnt<>0 then raise exception 'resolved nudge still appears in active inbox';end if;
end$$;
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $$
declare c uuid;c2 uuid;cnt int;
begin
 select id into c from public.v7_event_cases
  where request_key='77777777-7777-4777-8777-777777777777';
 perform public.v7_transition_event_case(c,'reopen',null,'第一次反馈不完整，补充记录');
 begin
  perform public.v7_send_case_nudge(c,'当天不可无限次重复催办');
  raise exception 'today nudge rate-limit bypassed by reopening';
 exception when check_violation then null;end;
 c2:=public.v7_create_event_case(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000001',
  '家校沟通','模拟家校回访跟进','仅虚构描述',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
 perform public.v7_transition_event_case(c2,'assign','33333333-3333-4333-8333-333333333333','');
 perform public.v7_set_case_deadline(c2,'2026-11-20'::date,null,'联系学生家庭的虚构安排');
 perform public.v7_send_case_nudge(c2,'请尽快反馈已经完成的家校沟通');
 select count(*) into cnt from public.v7_case_nudges where case_id=c2 and resolved_at is null;
 if cnt<>1 then raise exception 'nudge on family-contact followup not recorded';end if;
 perform public.v7_transition_event_case(
  c2,'assign','66666666-6666-4666-8666-666666666666','需要由另一名干部接续处理');
 select count(*) into cnt from public.v7_case_nudges
  where case_id=c2 and resolved_reason='已转派' and resolved_at is not null;
 if cnt<>1 then raise exception 'reassignment did not resolve previous cadre nudge';end if;
 select count(*) into cnt from public.v7_event_cases where id=c2 and assigned_to='66666666-6666-4666-8666-666666666666';
 if cnt<>1 then raise exception 'transfer not reflected in case state';end if;
end$$;
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
do $$
declare cnt int;
begin
 select count(*) into cnt from public.v7_case_nudges;
 if cnt<>0 then raise exception 'cross-class owner saw private reminders';end if;
end$$;
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub='44444444-4444-4444-8444-444444444444';
do $$
declare cnt int;
begin
 select count(*) into cnt from public.v7_case_nudges;
 if cnt<>0 then raise exception 'disabled cadre saw private reminders';end if;
end$$;
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $$
begin
 begin
  update public.v7_case_nudges set resolved_at=now();
  raise exception 'browser direct update to reminder permitted';
 exception when insufficient_privilege then null;end;
 begin
  delete from public.v7_case_nudges;
  raise exception 'browser deleted nudge audit';
 exception when insufficient_privilege then null;end;
end$$;
commit;
begin;
set local role anon;
do $$
begin
 begin
  perform public.v7_send_case_nudge(null,null);
  raise exception 'anonymous call to nudge RPC allowed';
 exception when insufficient_privilege then null;end;
end$$;
commit;
