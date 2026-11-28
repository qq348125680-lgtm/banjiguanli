-- Alpha 19 release gate. SELECT ONLY. Do not modify the production database.
-- Run as a privileged database reviewer. Never paste service_role into frontend code.
-- 1. Confirm RLS for the key tables.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in
 ('classes','students','class_delegates','cadre_submissions','attendance','operation_audit','point_events')
order by c.relname;

-- 2. Confirm the two Alpha9 RPCs are installed and public/anonymous EXECUTE is denied.
-- Absence of a function means writes must stay disabled.
select p.proname, pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef as security_definer,
       has_function_privilege('anon',p.oid,'EXECUTE') as anon_can_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_can_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('v7_cadre_roster','v7_review_attendance')
order by p.proname;

-- 3. Confirm existing attendance uniqueness (student_id, on_date).
select conname,pg_get_constraintdef(oid) as constraint_definition
from pg_constraint
where conrelid='public.attendance'::regclass and contype='u';

-- 4. Inspect cadre INSERT / teacher ALL policies (effective permission still needs real two-account tests).
select tablename,policyname,cmd,roles,qual,with_check
from pg_policies
where schemaname='public' and tablename in ('class_delegates','cadre_submissions','classes','students')
order by tablename,policyname;

-- 5. Count risky DEFINER functions anonymously executable; any nonzero requires review.
select count(*) as anonymously_callable_definer_functions
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef
and has_function_privilege('anon',p.oid,'EXECUTE');
