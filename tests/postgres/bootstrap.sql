-- Ephemeral GitHub Actions PostgreSQL 17 fixture. All identities are invented.
-- NEVER connect this fixture to any Supabase project or copy real student data.
create extension if not exists pgcrypto;
do $$begin
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin;end if;
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin;end if;
end$$;
create schema if not exists auth;
create or replace function auth.uid() returns uuid
language sql stable set search_path=''
as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
grant usage on schema public to authenticated,anon;

create table public.classes(
 id uuid primary key,
 owner_id uuid not null,
 name text not null
);
create table public.students(
 id uuid primary key,
 class_id uuid not null references public.classes(id),
 student_no text not null,
 name text not null,
 archived_at timestamptz
);
create table public.class_delegates(
 id uuid primary key default gen_random_uuid(),
 class_id uuid not null references public.classes(id),
 user_id uuid not null,
 duty text not null default '班干部',
 enabled boolean not null default true
);
create table public.cadre_submissions(
 id uuid primary key default gen_random_uuid(),
 class_id uuid not null references public.classes(id),
 student_id uuid not null references public.students(id),
 submitted_by uuid not null,
 entry_type text not null check(entry_type in('考勤','请假','违纪')),
 occurred_on date not null,
 details jsonb not null default '{}'::jsonb,
 status text not null default '待审核' check(status in('待审核','已通过','已驳回')),
 review_note text not null default '',
 reviewed_by uuid,
 reviewed_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.attendance(
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references public.students(id),
 on_date date not null,
 status text not null check(status in('出勤','迟到','缺勤','事假','病假')),
 note text default '',
 created_at timestamptz not null default now(),
 unique(student_id,on_date)
);

-- A simplified equivalent of the current production owner/delegate RLS model.
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.class_delegates enable row level security;
alter table public.cadre_submissions enable row level security;
alter table public.attendance enable row level security;
grant select on public.classes,public.students,public.class_delegates,public.cadre_submissions,public.attendance to authenticated;
grant insert,update on public.cadre_submissions to authenticated;
create policy classes_owner on public.classes for select to authenticated
 using(owner_id=(select auth.uid()));
create policy students_owner on public.students for select to authenticated
 using(exists(select 1 from public.classes c where c.id=class_id and c.owner_id=(select auth.uid())));
create policy delegates_self_read on public.class_delegates for select to authenticated
 using(user_id=(select auth.uid()));
create policy submissions_cadre_insert on public.cadre_submissions for insert to authenticated
 with check (
  status='待审核' and submitted_by=(select auth.uid()) and
  exists(select 1 from public.class_delegates d where
   d.class_id=cadre_submissions.class_id and d.user_id=(select auth.uid()) and d.enabled is true)
 );
create policy submissions_cadre_read on public.cadre_submissions for select to authenticated
 using(submitted_by=(select auth.uid()));
create policy submissions_teacher on public.cadre_submissions for all to authenticated
 using(exists(select 1 from public.classes c where c.id=class_id and c.owner_id=(select auth.uid())))
 with check(exists(select 1 from public.classes c where c.id=class_id and c.owner_id=(select auth.uid())));
create policy attendance_owner_read on public.attendance for select to authenticated
 using(exists(select 1 from public.students s join public.classes c on c.id=s.class_id
 where s.id=student_id and c.owner_id=(select auth.uid())));

-- Fake fixtures, not the school user's actual student information.
insert into public.classes(id,owner_id,name) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','A-测试班'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','B-测试班');
insert into public.students(id,class_id,student_no,name,archived_at) values
 ('aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','01','甲同学',null),
 ('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','02','乙同学',null),
 ('aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','03','归档样本',now()),
 ('bbbbbbbb-0000-4000-8000-000000000001','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','01','B班样本',null);
insert into public.class_delegates(class_id,user_id,duty,enabled) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333','班长',true),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','44444444-4444-4444-8444-444444444444','禁用干部',false);
