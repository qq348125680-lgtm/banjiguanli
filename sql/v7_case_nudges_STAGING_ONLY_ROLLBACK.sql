-- STAGING ONLY. Execute before dropping event-case parent module.
-- Drops only the new nudge triggers/RPC/table in isolated disposable database.
-- Do not run against a populated production database; it would erase nudge history.
begin;
drop trigger if exists v7_case_resolve_nudge on public.v7_event_cases;
drop function if exists public.v7_resolve_nudge_from_case();
drop function if exists public.v7_send_case_nudge(uuid,text);
drop table if exists public.v7_case_nudges;
alter table public.v7_event_case_history drop constraint v7_event_case_history_action_check;
alter table public.v7_event_case_history add constraint v7_event_case_history_action_check
 check(action in ('创建','指派','转派','反馈','结案','退回','设置期限','调整期限','取消期限'));
commit;
