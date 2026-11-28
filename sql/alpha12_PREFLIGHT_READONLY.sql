-- Run in SQL editor. Read-only, safe for existing production tables.
select 'v7_cadre_roster' as routine,exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='v7_cadre_roster') as installed
union all
select 'v7_review_attendance', exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='v7_review_attendance');
select tablename,policyname,cmd from pg_policies where schemaname='public' and tablename in ('students','cadre_submissions','attendance','class_delegates') order by tablename,policyname;
select conname,pg_get_constraintdef(oid) as definition from pg_constraint where conrelid='public.attendance'::regclass and contype='u';
