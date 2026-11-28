-- V7 official release | READ-ONLY catalog audit, checked 2026-11-28
-- Never invokes the listed functions, never reads student/business rows,
-- never runs GRANT/REVOKE/ALTER/DROP or changes production policies.
select
 n.nspname as function_schema,
 p.proname as function_name,
 pg_get_function_identity_arguments(p.oid) as arguments,
 pg_get_function_result(p.oid) as return_type,
 p.prorettype='pg_catalog.trigger'::regtype as trigger_function,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_can_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_can_execute,
 coalesce(array_to_string(p.proconfig,'|'),'') ilike '%search_path%' as sets_search_path,
 (pg_get_functiondef(p.oid) ilike '%auth.uid%' or pg_get_functiondef(p.oid) ilike '%auth.jwt%') as textual_auth_reference
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef
order by (has_function_privilege('anon',p.oid,'EXECUTE') and p.prorettype<>'pg_catalog.trigger'::regtype) desc,
 p.proname;

-- Count by role and callable vs trigger-only type, for reproducible triage.
select
 count(*)::int as definer_functions_in_public,
 count(*) filter (where has_function_privilege('anon',p.oid,'EXECUTE'))::int as anon_executable,
 count(*) filter (where has_function_privilege('authenticated',p.oid,'EXECUTE'))::int as authenticated_executable,
 count(*) filter (where has_function_privilege('anon',p.oid,'EXECUTE') and p.prorettype='pg_catalog.trigger'::regtype)::int as anon_trigger_functions,
 count(*) filter (where has_function_privilege('anon',p.oid,'EXECUTE') and p.prorettype<>'pg_catalog.trigger'::regtype)::int as anon_non_trigger_functions
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef;
