-- Disposable PG17 contract for event case lifecycle; all records are synthetic.
\set ON_ERROR_STOP on
-- Class A owner can create a draft case, idempotent retries must not duplicate history.
begin;
set local role authenticated;
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $$
declare v uuid; v2 uuid; n int;
begin
 v:=public.v7_create_event_case('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'aaaaaaaa-0000-4000-8000-000000000001','违纪','模拟课堂事件','用于验收的虚构描述',
 '77777777-7777-4777-8777-777777777777');
 v2:=public.v7_create_event_case('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'aaaaaaaa-0000-4000-8000-000000000001','违纪','模拟课堂事件','用于验收的虚构描述',
 '77777777-7777-4777-8777-777777777777');
 if v<>v2 then raise exception 'idempotent create changed ID';end if;
 select count(*) into n from public.v7_event_case_history where case_id=v;
 if n<>1 then raise exception 'duplicate history for idempotent retry';end if;
 begin
  perform public.v7_create_event_case('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-0000-4000-8000-000000000001','违纪','changed title','',
  '77777777-7777-4777-8777-777777777777');
  raise exception 'same key accepted different payload';
 exception when unique_violation then null;end;
 begin
  perform public.v7_transition_event_case(v,'assign','99999999-9999-4999-8999-999999999999','');
  raise exception 'not-class assignee accepted';
 exception when check_violation then null;end;
 perform public.v7_transition_event_case(v,'assign','33333333-3333-4333-8333-333333333333','');
 select count(*) into n from public.v7_event_cases where id=v and status='处理中';
 if n<>1 then raise exception 'owner assignment failed';end if;
end$$;
commit;

-- Enabled delegate may create, but cannot approve, assign or modify unrelated cases.
begin;
set local role authenticated;
set local request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
do $$
declare v uuid;n int;
begin
 select id into v from public.v7_event_cases where request_key='77777777-7777-4777-8777-777777777777';
 if v is null then raise exception 'assignee cannot read assigned case';end if;
 begin
  perform public.v7_transition_event_case(v,'close',null,'fake close');
  raise exception 'delegate closed case without review';
 exception when check_violation then null;end;
 begin
  perform public.v7_transition_event_case(v,'assign','33333333-3333-4333-8333-333333333333','');
  raise exception 'delegate assigned case';
 exception when insufficient_privilege then null;end;
 perform public.v7_transition_event_case(v,'reply',null,'模拟核实并完成教育谈话');
 select count(*) into n from public.v7_event_case_history where case_id=v;
 if n<>3 then raise exception 'event action history missing (create,assign,reply)';end if;
end$$;
commit;

-- Unrelated owner and disabled delegate cannot read or mutate other class events.
begin;
set local role authenticated;
set local request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
do $$
declare n int;
begin
 select count(*) into n from public.v7_event_cases where class_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 if n<>0 then raise exception 'cross-class event leaked';end if;
 begin
  perform public.v7_create_event_case('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'aaaaaaaa-0000-4000-8000-000000000001','其他','cross-class','',
   '99999999-9999-4999-8999-999999999999');
  raise exception 'cross-class creation accepted';
 exception when insufficient_privilege then null;end;
end$$;
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub='44444444-4444-4444-8444-444444444444';
do $$
declare n int;
begin
 select count(*) into n from public.v7_event_cases;
 if n<>0 then raise exception 'disabled delegate sees event case';end if;
 begin
  perform public.v7_create_event_case('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'aaaaaaaa-0000-4000-8000-000000000001','其他','disabled','',
   '88888888-8888-4888-8888-888888888888');
  raise exception 'disabled delegate could create';
 exception when insufficient_privilege then null;end;
end$$;
commit;

-- Owner accepts follow-up: closed case and complete history, no re-close.
begin;
set local role authenticated;
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $$
declare v uuid;n int;
begin
 select id into v from public.v7_event_cases where request_key='77777777-7777-4777-8777-777777777777';
 perform public.v7_transition_event_case(v,'close',null,'班主任已核查，准予结案');
 select count(*) into n from public.v7_event_cases where id=v and status='已结案' and closed_at is not null;
 if n<>1 then raise exception 'case not closed';end if;
 begin
  perform public.v7_transition_event_case(v,'close',null,'repeat');
  raise exception 'double close allowed';
 exception when check_violation then null;end;
 perform public.v7_transition_event_case(v,'reopen',null,'处理证据不足，退回补充');
 select count(*) into n from public.v7_event_cases where id=v and status='处理中' and closed_at is null;
 if n<>1 then raise exception 'reopen did not clear completion';end if;
 select count(*) into n from public.v7_event_case_history where case_id=v;
 if n<>5 then raise exception 'event history expected 5, got %',n;end if;
end$$;
commit;

-- No browser user should be able to alter a case or its history outside RPC.
begin;
set local role authenticated;
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $$
begin
 begin
  delete from public.v7_event_case_history where true;
  raise exception 'direct delete must be denied';
 exception when insufficient_privilege then null;end;
 begin
  update public.v7_event_cases set status='已结案';
  raise exception 'direct update must be denied';
 exception when insufficient_privilege then null;end;
end$$;
commit;
begin;
set local role anon;
do $$
begin
 begin
  perform public.v7_create_event_case(null,null,null,null,null,null);
  raise exception 'anon should not call event creation RPC';
 exception when insufficient_privilege then null;end;
end$$;
commit;
do $$
declare n int;
begin
 select count(*) into n from public.v7_event_cases;
 if n<>1 then raise exception 'expected exactly one test case, got %',n;end if;
end$$;
