-- V7 Guardian/Family Contact Links v1: STAGING ONLY.
-- This table is a teacher-verified CONTACT RELATIONSHIP, not a parent login.
-- Does not access or migrate any real existing family contacts or student data.
begin;
create table public.v7_guardian_links(
 id uuid primary key default gen_random_uuid(),
 request_key uuid not null,
 class_id uuid not null references public.classes(id),
 student_id uuid not null references public.students(id),
 contact_name text not null check (char_length(btrim(contact_name)) between 2 and 80),
 relation text not null check (relation in ('父亲','母亲','监护人','其他亲属','其他')),
 contact_phone text not null check(char_length(contact_phone) between 7 and 25 and contact_phone ~ '^[0-9+() .-]+$'),
 verification_status text not null default '待核实' check (verification_status in ('待核实','已核实','已失效')),
 verified_at timestamptz,
 created_by uuid not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(class_id,request_key),
 constraint v7_guardian_verified_time check(verification_status<>'已核实' or verified_at is not null)
);
create unique index v7_guardian_active_phone on public.v7_guardian_links(class_id,student_id,contact_phone)
 where verification_status<>'已失效';
create index v7_guardian_class_student on public.v7_guardian_links(class_id,student_id,created_at desc);
create table public.v7_guardian_link_history(
 id uuid primary key default gen_random_uuid(),
 link_id uuid not null references public.v7_guardian_links(id) on delete restrict,
 class_id uuid not null references public.classes(id),
 actor_id uuid not null,
 action text not null check(action in ('创建','核实','停用','恢复核实')),
 from_status text,
 to_status text not null,
 note text not null default '' check(char_length(note)<=300),
 created_at timestamptz not null default now()
);
create index v7_guardian_history_link on public.v7_guardian_link_history(link_id,created_at,id);
alter table public.v7_guardian_links enable row level security;
alter table public.v7_guardian_link_history enable row level security;
revoke all on public.v7_guardian_links,public.v7_guardian_link_history from public,anon,authenticated;
grant select on public.v7_guardian_links,public.v7_guardian_link_history to authenticated;
create policy v7_guardian_teacher_select on public.v7_guardian_links
 for select to authenticated using (
  exists(select 1 from public.classes c where c.id=v7_guardian_links.class_id and c.owner_id=(select auth.uid()))
 );
create policy v7_guardian_history_teacher_select on public.v7_guardian_link_history
 for select to authenticated using (
  exists(select 1 from public.v7_guardian_links g
   where g.id=v7_guardian_link_history.link_id and g.class_id=v7_guardian_link_history.class_id)
 );
-- No direct INSERT/UPDATE/DELETE table privileges; only teacher-scoped RPCs.
create or replace function public.v7_create_guardian_link(
 p_class_id uuid,p_student_id uuid,p_name text,p_relation text,p_phone text,p_request_key uuid
) returns uuid language plpgsql volatile security definer set search_path=''
as $fn$
declare v_actor uuid := (select auth.uid());v_new uuid;v_count int;v_old public.v7_guardian_links%rowtype;
begin
 if v_actor is null or p_class_id is null or p_student_id is null or p_request_key is null
   or not exists(select 1 from public.classes c where c.id=p_class_id and c.owner_id=v_actor)
 then raise exception '仅班主任可登记当前班级联系人' using errcode='42501';end if;
 if p_name is null or char_length(btrim(p_name)) not between 2 and 80
  or p_relation is null or p_relation not in ('父亲','母亲','监护人','其他亲属','其他')
  or p_phone is null or char_length(btrim(p_phone)) not between 7 and 25
  or btrim(p_phone) !~ '^[0-9+() .-]+$'
 then raise exception '联系人姓名、关系或号码格式不合法' using errcode='22023';end if;
 if not exists(select 1 from public.students s
  where s.id=p_student_id and s.class_id=p_class_id and s.archived_at is null)
 then raise exception '学生不属于当前在读班级' using errcode='23514';end if;
 insert into public.v7_guardian_links(request_key,class_id,student_id,contact_name,relation,contact_phone,created_by)
 values(p_request_key,p_class_id,p_student_id,btrim(p_name),p_relation,btrim(p_phone),v_actor)
 on conflict(class_id,request_key) do nothing returning id into v_new;
 get diagnostics v_count=row_count;
 if v_count=0 then
  select * into v_old from public.v7_guardian_links where class_id=p_class_id and request_key=p_request_key;
  if not found or v_old.student_id<>p_student_id or v_old.contact_name<>btrim(p_name)
   or v_old.relation<>p_relation or v_old.contact_phone<>btrim(p_phone) or v_old.created_by<>v_actor
  then raise exception '联系人请求编号已使用，内容不一致' using errcode='23505';end if;
  return v_old.id;
 end if;
 insert into public.v7_guardian_link_history(link_id,class_id,actor_id,action,from_status,to_status,note)
 values(v_new,p_class_id,v_actor,'创建',null,'待核实','');
 return v_new;
end;
$fn$;
create or replace function public.v7_change_guardian_link(
 p_id uuid,p_action text,p_note text
) returns jsonb language plpgsql volatile security definer set search_path=''
as $fn$
declare v_actor uuid := (select auth.uid());v public.v7_guardian_links%rowtype;v_next text;v_name text;
begin
 if v_actor is null or p_id is null or p_action not in ('verify','deactivate','reactivate')
  or nullif(btrim(coalesce(p_note,'')),'') is null or char_length(coalesce(p_note,''))>300
 then raise exception '联系人核实/停用说明不完整' using errcode='22023';end if;
 select * into v from public.v7_guardian_links where id=p_id for update;
 if not found then raise exception '联系人关系不存在' using errcode='P0002';end if;
 if not exists(select 1 from public.classes c where c.id=v.class_id and c.owner_id=v_actor)
 then raise exception '只能处理本人班级的联系人关系' using errcode='42501';end if;
 if p_action='verify' and v.verification_status='待核实' then
  v_next:='已核实';v_name:='核实';
  update public.v7_guardian_links set verification_status=v_next,verified_at=now(),updated_at=now() where id=p_id;
 elsif p_action='deactivate' and v.verification_status in ('待核实','已核实') then
  v_next:='已失效';v_name:='停用';
  update public.v7_guardian_links set verification_status=v_next,updated_at=now() where id=p_id;
 elsif p_action='reactivate' and v.verification_status='已失效' then
  v_next:='待核实';v_name:='恢复核实';
  update public.v7_guardian_links set verification_status=v_next,verified_at=null,updated_at=now() where id=p_id;
 else
  raise exception '联系人状态已经变化，请重新读取后核对' using errcode='23514';
 end if;
 insert into public.v7_guardian_link_history(link_id,class_id,actor_id,action,from_status,to_status,note)
 values(p_id,v.class_id,v_actor,v_name,v.verification_status,v_next,btrim(p_note));
 return jsonb_build_object('id',p_id,'status',v_next,'action',v_name);
end;
$fn$;
revoke all on function public.v7_create_guardian_link(uuid,uuid,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.v7_change_guardian_link(uuid,text,text) from public,anon,authenticated;
grant execute on function public.v7_create_guardian_link(uuid,uuid,text,text,text,uuid) to authenticated;
grant execute on function public.v7_change_guardian_link(uuid,text,text) to authenticated;
commit;
