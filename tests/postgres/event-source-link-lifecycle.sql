-- Disposable PG17: linked cases must verify class AND student with exact record IDs.
\set ON_ERROR_STOP on
begin;
set local role authenticated;
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $$
declare c uuid;c2 uuid;n int;
begin
 c:=public.v7_create_linked_event_case(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000001',
 '考勤','迟到记录跟进','需核实本次迟到','a3333333-3333-4333-8333-333333333333',
 'a1111111-1111-4111-8111-111111111111');
 c2:=public.v7_create_linked_event_case(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000001',
 '考勤','迟到记录跟进','需核实本次迟到','a3333333-3333-4333-8333-333333333333',
 'a1111111-1111-4111-8111-111111111111');
 if c<>c2 then raise exception 'duplicate request changed linked case UUID';end if;
 select count(*) into n from public.v7_event_case_sources where case_id=c;
 if n<>1 then raise exception 'retry made duplicate source link';end if;
 select count(*) into n from public.v7_event_case_history where case_id=c;
 if n<>1 then raise exception 'retry made duplicate initial case history';end if;
 begin
  perform public.v7_create_linked_event_case(
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000001',
   '考勤','另一个重复工单','重复源数据','a4444444-4444-4444-8444-444444444444',
   'a1111111-1111-4111-8111-111111111111');
  raise exception 'same original attendance accepted two cases';
 exception when unique_violation then null;end;
 begin
  perform public.v7_create_linked_event_case(
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000002',
   '考勤','错学生关联','跨学生','a5555555-5555-4555-8555-555555555555',
   'a1111111-1111-4111-8111-111111111111');
  raise exception 'cross-student attendance linked';
 exception when check_violation then null;end;
 begin
  perform public.v7_create_linked_event_case(
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000001',
   '考勤','别班考勤记录','跨班原记录','a6666666-6666-4666-8666-666666666666',
   'a2222222-2222-4222-8222-222222222222');
  raise exception 'cross-class record accepted';
 exception when check_violation then null;end;
 begin
  perform public.v7_create_linked_event_case(
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000001',
   '考勤','未知来源','无记录','a7777777-7777-4777-8777-777777777777',
   'a9999999-9999-4999-8999-999999999999');
  raise exception 'unknown source record accepted';
 exception when check_violation then null;end;
 begin
  perform public.v7_create_linked_event_case(
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000001',
   '其他','不允许自由来源','非法分类','a8888888-8888-4888-8888-888888888888',
   'a1111111-1111-4111-8111-111111111111');
  raise exception 'invalid source kind accepted';
 exception when invalid_parameter_value then null;end;
 perform public.v7_create_linked_event_case(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000001',
  '请假','请假跟进','复核申请','b3333333-3333-4333-8333-333333333333',
  'b1111111-1111-4111-8111-111111111111');
 perform public.v7_create_linked_event_case(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000001',
  '违纪','纪律跟进','确认事实','c3333333-3333-4333-8333-333333333333',
  'c1111111-1111-4111-8111-111111111111');
 perform public.v7_create_linked_event_case(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000001',
  '积分','积分复核','核对分值','d3333333-3333-4333-8333-333333333333',
  'd1111111-1111-4111-8111-111111111111');
 perform public.v7_create_linked_event_case(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000001',
  '值日','卫生检查','检查责任','e3333333-3333-4333-8333-333333333333',
  'e1111111-1111-4111-8111-111111111111');
 perform public.v7_create_linked_event_case(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000001',
  '家校沟通','沟通后续跟进','不展示隐私谈话','f3333333-3333-4333-8333-333333333333',
  'f1111111-1111-4111-8111-111111111111');
 select count(*) into n from public.v7_event_case_sources where class_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 if n<>6 then raise exception 'expected six linked original-record categories; got %',n;end if;
 select count(*) into n from public.attendance where id='a1111111-1111-4111-8111-111111111111' and status='迟到';
 if n<>1 then raise exception 'source linking mutated original attendance';end if;
end$$;
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
do $$
declare n int;
begin
 select count(*) into n from public.v7_event_case_sources;
 if n<>0 then raise exception 'cadre can inspect owner-only source link identifiers';end if;
 begin
  perform public.v7_create_linked_event_case(
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000001',
   '请假','干部越权关联','禁止','b4444444-4444-4444-8444-444444444444',
   'b1111111-1111-4111-8111-111111111111');
  raise exception 'delegate linked raw source';
 exception when insufficient_privilege then null;end;
end$$;
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
do $$
declare n int;
begin
 select count(*) into n from public.v7_event_case_sources;
 if n<>0 then raise exception 'other-class owner can inspect source link identifiers';end if;
end$$;
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $$
begin
 begin
  update public.v7_event_case_sources set source_record_id='a2222222-2222-4222-8222-222222222222';
  raise exception 'browser can change source linkage directly';
 exception when insufficient_privilege then null;end;
end$$;
commit;
begin;
set local role anon;
do $$
begin
 begin
  perform public.v7_create_linked_event_case(null,null,null,null,null,null,null);
  raise exception 'anon can create linked case';
 exception when insufficient_privilege then null;end;
end$$;
commit;
