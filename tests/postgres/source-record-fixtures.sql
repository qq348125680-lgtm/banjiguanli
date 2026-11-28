-- Disposable PG17 only: fake legacy source records; never real student information.
-- attendance exists in tests/postgres/bootstrap.sql.
create table public.leave_requests(
 id uuid primary key, student_id uuid not null references public.students(id));
create table public.incidents(
 id uuid primary key, student_id uuid not null references public.students(id));
create table public.point_events(
 id uuid primary key, student_id uuid not null references public.students(id));
create table public.duty_assignments(
 id uuid primary key, student_id uuid not null references public.students(id),
 class_id uuid not null references public.classes(id));
create table public.family_contacts(
 id uuid primary key, student_id uuid not null references public.students(id));
insert into public.attendance(id,student_id,on_date,status) values
 ('a1111111-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000001','2026-11-20','迟到'),
 ('a2222222-2222-4222-8222-222222222222','bbbbbbbb-0000-4000-8000-000000000001','2026-11-21','迟到');
insert into public.leave_requests values
 ('b1111111-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000001');
insert into public.incidents values
 ('c1111111-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000001');
insert into public.point_events values
 ('d1111111-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000001');
insert into public.duty_assignments values
 ('e1111111-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.family_contacts values
 ('f1111111-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000001');
