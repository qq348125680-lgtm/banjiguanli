-- STAGING / disposable PostgreSQL ONLY: remove only new guardian contact module.
begin;
drop function if exists public.v7_change_guardian_link(uuid,text,text);
drop function if exists public.v7_create_guardian_link(uuid,uuid,text,text,text,uuid);
drop table if exists public.v7_guardian_link_history;
drop table if exists public.v7_guardian_links;
commit;
