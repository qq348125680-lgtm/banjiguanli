-- DISPOSABLE PG17 ONLY. Use immediately before dropping the entire V7 event-case
-- module. This stops deadline RPCs and indexes, then the parent-module
-- rollback drops all synthetic case tables (including their history).
-- Do NOT use this as a standalone rollback on a populated real project:
-- stripping columns/history would destroy tracked school workflow evidence.
begin;
drop function if exists public.v7_class_case_overview(uuid);
drop function if exists public.v7_set_case_deadline(uuid,date,date,text);
drop index if exists public.v7_event_cases_open_due_idx;
commit;
