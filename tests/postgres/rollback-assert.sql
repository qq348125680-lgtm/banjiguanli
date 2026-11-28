-- After staging rollback, all V7-only functions, triggers and index must be gone.
do $$
declare n int;
begin
 if to_regprocedure('public.v7_cadre_roster(uuid)') is not null then raise exception 'roster RPC survived rollback'; end if;
 if to_regprocedure('public.v7_review_attendance(uuid,text,text)') is not null then raise exception 'review RPC survived rollback'; end if;
 if to_regclass('public.v7_pending_student_day_unique') is not null then raise exception 'pending index survived rollback'; end if;
 if exists(select 1 from pg_trigger where tgname='trg_v7_cadre_student_scope' and not tgisinternal) then raise exception 'student scope trigger survived rollback'; end if;
 if to_regnamespace('v7_private') is not null then raise exception 'private schema survived rollback'; end if;
 select count(*) into n from public.attendance;
 if n<>2 then raise exception 'rollback changed persisted attendance rows: %',n;end if;
 select count(*) into n from public.cadre_submissions where entry_type='请假';
 if n<>2 then raise exception 'rollback changed leave requests: %',n;end if;
end$$;
