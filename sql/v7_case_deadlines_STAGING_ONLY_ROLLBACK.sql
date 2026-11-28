-- STAGING ONLY: run before v7_event_cases_STAGING_ONLY_ROLLBACK.sql.
begin;
drop function if exists public.v7_class_case_overview(uuid);
drop function if exists public.v7_set_case_deadline(uuid,date,date,text);
drop index if exists public.v7_event_cases_open_due_idx;
alter table public.v7_event_case_history
 drop constraint v7_event_case_history_action_check;
alter table public.v7_event_case_history
 add constraint v7_event_case_history_action_check
 check(action in ('创建','指派','转派','反馈','结案','退回'));
alter table public.v7_event_case_history
 drop column previous_due_on,
 drop column next_due_on;
alter table public.v7_event_cases drop column due_on;
commit;
