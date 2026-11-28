-- STAGING ONLY. Execute before dropping event-case parent module.
-- Drops only the new nudge triggers/RPC/table in isolated disposable database.
-- Do not run against a populated production database; it would erase nudge history.
begin;
drop trigger if exists v7_case_resolve_nudge on public.v7_event_cases;
drop function if exists public.v7_resolve_nudge_from_case();
drop function if exists public.v7_send_case_nudge(uuid,text);
drop table if exists public.v7_case_nudges;
-- Keep the historical '催办' action accepted until the parent case module is
-- dropped: older action constraints cannot be restored without deleting audit.
-- This rollback script is for the synthetic environment teardown only.
commit;
