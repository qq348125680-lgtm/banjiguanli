-- STAGING/EPHEMERAL ONLY: remove new event objects, never existing class data.
begin;
drop function if exists public.v7_transition_event_case(uuid,text,uuid,text);
drop function if exists public.v7_create_event_case(uuid,uuid,text,text,text,uuid);
drop table if exists public.v7_event_case_history;
drop table if exists public.v7_event_cases;
commit;
