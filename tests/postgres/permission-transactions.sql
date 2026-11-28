-- Execute after bootstrap.sql and staging migration in temporary PostgreSQL.
-- These are invented identities. Every assertion raises on failure.
\set ON_ERROR_STOP on

-- Enabled class A delegate: sees ONLY A's two active students.
begin;
set local role authenticated;
set local request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
do $$
declare n int;
begin
 select count(*) into n from public.v7_cadre_roster('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 if n<>2 then raise exception 'delegate A roster expected 2, got %',n;end if;
 select count(*) into n from public.students;
 if n<>0 then raise exception 'delegate directly read students without owner RLS';end if;
 begin
  perform 1 from public.v7_cadre_roster('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  raise exception 'cross-class roster should have failed';
 exception when insufficient_privilege then null;
 end;
end$$;
-- First pending request, then double submission is rejected.
insert into public.cadre_submissions
 (id,class_id,student_id,submitted_by,entry_type,occurred_on,details,status)
values('cccccccc-cccc-4ccc-8ccc-000000000001',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'aaaaaaaa-0000-4000-8000-000000000001',
 '33333333-3333-4333-8333-333333333333','考勤','2026-11-28',
 '{"status":"迟到"}','待审核');
do $$
begin
 begin
  insert into public.cadre_submissions(class_id,student_id,submitted_by,entry_type,occurred_on,details,status)
  values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'aaaaaaaa-0000-4000-8000-000000000001',
   '33333333-3333-4333-8333-333333333333','考勤','2026-11-28',
   '{"status":"迟到"}','待审核');
  raise exception 'duplicate attendance pending insert should fail';
 exception when unique_violation then null;
 end;
 -- Valid delegate cannot inject a B-class student into A class.
 begin
  insert into public.cadre_submissions(class_id,student_id,submitted_by,entry_type,occurred_on,details,status)
  values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'bbbbbbbb-0000-4000-8000-000000000001',
   '33333333-3333-4333-8333-333333333333','考勤','2026-11-29',
   '{"status":"迟到"}','待审核');
  raise exception 'cross-class student submission should fail';
 exception when sqlstate '23514' then null;
 end;
 begin
  insert into public.cadre_submissions(class_id,student_id,submitted_by,entry_type,occurred_on,details,status)
  values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'aaaaaaaa-0000-4000-8000-000000000003',
   '33333333-3333-4333-8333-333333333333','考勤','2026-11-29',
   '{"status":"迟到"}','待审核');
  raise exception 'archived student submission should fail';
 exception when sqlstate '23514' then null;
 end;
end$$;
-- Two same-day leave requests remain legitimate; new partial index must not block.
insert into public.cadre_submissions
 (id,class_id,student_id,submitted_by,entry_type,occurred_on,details,status)
values
 ('dddddddd-dddd-4ddd-8ddd-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333333',
  '请假','2026-11-28','{}','待审核'),
 ('dddddddd-dddd-4ddd-8ddd-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333333',
  '请假','2026-11-28','{}','待审核');
-- Additional rows for reject, invalid state, and real concurrent approval test.
insert into public.cadre_submissions
 (id,class_id,student_id,submitted_by,entry_type,occurred_on,details,status)
values
 ('cccccccc-cccc-4ccc-8ccc-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-0000-4000-8000-000000000002','33333333-3333-4333-8333-333333333333',
  '考勤','2026-11-29','{"status":"病假"}','待审核'),
 ('cccccccc-cccc-4ccc-8ccc-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-0000-4000-8000-000000000002','33333333-3333-4333-8333-333333333333',
  '考勤','2026-11-30','{"status":"任意错误状态"}','待审核'),
 ('cccccccc-cccc-4ccc-8ccc-000000000004','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333333',
  '考勤','2026-12-01','{"status":"出勤"}','待审核');
commit;

-- A different enabled class A delegate must hit the same uniqueness guard.
begin;
set local role authenticated;
set local request.jwt.claim.sub='66666666-6666-4666-8666-666666666666';
do $
declare n int;
begin
 select count(*) into n from public.v7_cadre_roster('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 if n<>2 then raise exception 'second delegate cannot read authorized roster';end if;
 begin
  insert into public.cadre_submissions(class_id,student_id,submitted_by,entry_type,occurred_on,details,status)
  values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'aaaaaaaa-0000-4000-8000-000000000001',
   '66666666-6666-4666-8666-666666666666','考勤','2026-11-28',
   '{"status":"迟到"}','待审核');
  raise exception 'different cadre submitted duplicate pending attendance';
 exception when unique_violation then null;
 end;
end$;
commit;

-- Disabled user cannot read roster OR INSERT a request even with known UUIDs.
begin;
set local role authenticated;
set local request.jwt.claim.sub='44444444-4444-4444-8444-444444444444';
do $
begin
 begin
  perform * from public.v7_cadre_roster('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  raise exception 'disabled user should have no roster access';
 exception when insufficient_privilege then null;
 end;
 begin
  insert into public.cadre_submissions(class_id,student_id,submitted_by,entry_type,occurred_on,details,status)
  values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'aaaaaaaa-0000-4000-8000-000000000002',
   '44444444-4444-4444-8444-444444444444','考勤','2026-12-02',
   '{"status":"迟到"}','待审核');
  raise exception 'disabled delegate should not insert pending application';
 exception when insufficient_privilege then null;
 end;
end$;
commit;

-- A completely anonymous client has no EXECUTE grant on privileged roster RPC.
begin;
set local role anon;
do $
begin
 begin
  perform * from public.v7_cadre_roster('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  raise exception 'anonymous user accessed privileged roster';
 exception when insufficient_privilege then null;
 end;
end$;
commit;

-- Unrelated owner B cannot approve any A application.
begin;
set local role authenticated;
set local request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
do $$
begin
 begin
  perform public.v7_review_attendance('cccccccc-cccc-4ccc-8ccc-000000000001','approve','no access');
  raise exception 'B owner should be denied A approval';
 exception when insufficient_privilege then null;
 end;
end$$;
commit;

-- Real A owner: one atomic approval; cannot review twice or approve malformed data.
begin;
set local role authenticated;
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $$
declare n int; response jsonb;
begin
 select count(*) into n from public.v7_cadre_roster('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 if n<>2 then raise exception 'owner roster expected 2';end if;
 response:=public.v7_review_attendance('cccccccc-cccc-4ccc-8ccc-000000000001','approve','已核对');
 if response->>'status'<>'已通过' or response->>'posted'<>'true' then
  raise exception 'atomic approval failed: %',response;
 end if;
 select count(*) into n from public.attendance where on_date='2026-11-28';
 if n<>1 then raise exception 'approved attendance missing';end if;
 begin
  perform public.v7_review_attendance('cccccccc-cccc-4ccc-8ccc-000000000001','approve','second');
  raise exception 'second approval should fail';
 exception when unique_violation then null;
 end;
 begin
  perform public.v7_review_attendance('cccccccc-cccc-4ccc-8ccc-000000000003','approve','bad status');
  raise exception 'unknown attendance status should fail';
 exception when sqlstate '22023' then null;
 end;
 select count(*) into n from public.attendance where on_date='2026-11-30';
 if n<>0 then raise exception 'invalid status created attendance';end if;
 begin
  perform public.v7_review_attendance('cccccccc-cccc-4ccc-8ccc-000000000002','reject','');
  raise exception 'reject without a reason should fail';
 exception when sqlstate '22023' then null;
 end;
 response:=public.v7_review_attendance('cccccccc-cccc-4ccc-8ccc-000000000002','reject','填写具体原因');
 if response->>'status'<>'已驳回' then raise exception 'reject did not update status';end if;
 begin
  perform public.v7_review_attendance('dddddddd-dddd-4ddd-8ddd-000000000001','approve','not supported');
  raise exception 'leave must not be approved through attendance RPC';
 exception when feature_not_supported then null;
 end;
end$$;
commit;
-- Final verification: prior failures rolled back; just one posted attendance so far.
do $$
declare n int;
begin
 select count(*) into n from public.attendance;
 if n<>1 then raise exception 'expected 1 posted attendance before concurrency, got %',n;end if;
 select count(*) into n from public.cadre_submissions where id='cccccccc-cccc-4ccc-8ccc-000000000003' and status='待审核';
 if n<>1 then raise exception 'invalid approval altered source request';end if;
end$$;
