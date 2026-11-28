-- Disposable PostgreSQL/Supabase staging ONLY: remove linked-source expansion.
begin;
drop function if exists public.v7_create_linked_event_case(uuid,uuid,text,text,text,uuid,uuid);
drop table if exists public.v7_event_case_sources;
commit;
