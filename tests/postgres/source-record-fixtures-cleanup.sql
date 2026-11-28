-- Disposable PG17 ONLY. Restore original fake base table counts exactly.
-- Only these two IDs were inserted by source-record-fixtures.sql.
begin;
delete from public.attendance where id in(
 'a1111111-1111-4111-8111-111111111111',
 'a2222222-2222-4222-8222-222222222222'
);
drop table if exists public.leave_requests;
drop table if exists public.incidents;
drop table if exists public.point_events;
drop table if exists public.duty_assignments;
drop table if exists public.family_contacts;
do $$declare n int;begin
 select count(*) into n from public.attendance;
 if n<>2 then raise exception 'cleanup did not restore two baseline fake attendance rows, count %',n;end if;
end$$;
commit;
