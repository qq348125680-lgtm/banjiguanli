-- STAGING ONLY: remove a read-only weekly report RPC, no audit data involved.
begin;
drop function if exists public.v7_weekly_case_report(uuid,date);
commit;
