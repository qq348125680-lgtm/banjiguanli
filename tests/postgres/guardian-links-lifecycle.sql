-- Disposable synthetic test for explicitly registered family contact relationships.
\set ON_ERROR_STOP on
begin;
set local role authenticated;
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $$
declare v uuid;v2 uuid;n int;
begin
 v:=public.v7_create_guardian_link('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'aaaaaaaa-0000-4000-8000-000000000001','测试家长甲','母亲','13800000001',
 '99999999-9999-4999-8999-999999999999');
 v2:=public.v7_create_guardian_link('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'aaaaaaaa-0000-4000-8000-000000000001','测试家长甲','母亲','13800000001',
 '99999999-9999-4999-8999-999999999999');
 if v<>v2 then raise exception 'guardian idempotency mismatch';end if;
 select count(*) into n from public.v7_guardian_link_history where link_id=v;
 if n<>1 then raise exception 'duplicate guardian creation audit';end if;
 begin
  perform public.v7_create_guardian_link('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-0000-4000-8000-000000000001','更改姓名','父亲','13800000001',
  '99999999-9999-4999-8999-999999999999');
  raise exception 'request key reused for changed guardian identity';
 exception when unique_violation then null;end;
 begin
  perform public.v7_create_guardian_link('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-0000-4000-8000-000000000001','测试家长甲','母亲','13800000001',
  '88888888-8888-4888-8888-888888888888');
  raise exception 'duplicate active student-phone allowed';
 exception when unique_violation then null;end;
 begin
  perform public.v7_change_guardian_link(v,'verify','');
  raise exception 'guardian verified without note';
 exception when invalid_parameter_value then null;end;
 perform public.v7_change_guardian_link(v,'verify','班主任已核对监护人联系方式');
 select count(*) into n from public.v7_guardian_links where id=v and verification_status='已核实' and verified_at is not null;
 if n<>1 then raise exception 'guardian verification not persisted';end if;
 begin
  perform public.v7_change_guardian_link(v,'verify','重复核实');
  raise exception 'duplicate verification allowed';
 exception when check_violation then null;end;
 perform public.v7_change_guardian_link(v,'deactivate','号码不再使用');
 select count(*) into n from public.v7_guardian_links where id=v and verification_status='已失效';
 if n<>1 then raise exception 'guardian deactivation failed';end if;
 perform public.v7_change_guardian_link(v,'reactivate','新学期重新核实');
 select count(*) into n from public.v7_guardian_links where id=v and verification_status='待核实' and verified_at is null;
 if n<>1 then raise exception 'reactivation should require re-verification';end if;
 perform public.v7_change_guardian_link(v,'verify','已再次核实联系方式');
 select count(*) into n from public.v7_guardian_link_history where link_id=v;
 if n<>5 then raise exception 'guardian verification history expected 5 got %',n;end if;
end$$;
commit;

-- Class cadre has no access to guardian contact phone or owner-only operations.
begin;
set local role authenticated;
set local request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
do $$
declare n int;
begin
 select count(*) into n from public.v7_guardian_links;
 if n<>0 then raise exception 'delegate can enumerate family phones';end if;
 select count(*) into n from public.v7_guardian_link_history;
 if n<>0 then raise exception 'delegate can enumerate family change history';end if;
 begin
  perform public.v7_create_guardian_link('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'aaaaaaaa-0000-4000-8000-000000000001','不应通过','父亲','13800000002',
   '77777777-7777-4777-8777-777777777777');
  raise exception 'delegate created guardian contact';
 exception when insufficient_privilege then null;end;
end$$;
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
do $$
declare n int;
begin
 select count(*) into n from public.v7_guardian_links;
 if n<>0 then raise exception 'cross-class owner sees unrelated guardians';end if;
end$$;
commit;
begin;
set local role anon;
do $$
begin
 begin
  perform public.v7_create_guardian_link(null,null,null,null,null,null);
  raise exception 'anon created guardian contact';
 exception when insufficient_privilege then null;end;
end$$;
commit;

-- direct UPDATE/DELETE are prohibited to all normal signed-in users.
begin;
set local role authenticated;
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $$
begin
 begin
  update public.v7_guardian_links set contact_phone='18800000001';
  raise exception 'direct UPDATE on guardian contact allowed';
 exception when insufficient_privilege then null;end;
 begin
  delete from public.v7_guardian_link_history;
  raise exception 'direct DELETE on guardian contact audit allowed';
 exception when insufficient_privilege then null;end;
end$$;
commit;
