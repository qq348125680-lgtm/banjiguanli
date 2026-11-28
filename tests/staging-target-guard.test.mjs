import test from 'node:test';
import assert from 'node:assert/strict';
import {validateStagingReadOnlyTarget} from '../src/lib/staging-target-guard.mjs';
const valid={
 mode:'READ_ONLY_SYNTHETIC',
 url:'https://abcdefghijklmnopqrst.supabase.co/',
 expectedRef:'abcdefghijklmnopqrst',
 classId:'11111111-1111-4111-8111-111111111111',
 otherClassId:'22222222-2222-4222-8222-222222222222',
 publishableKey:'sb_publishable_fake_for_unit_test'
};
test('manual staging config requires matching isolated project ref and two distinct classes',()=>{
 const result=validateStagingReadOnlyTarget(valid);
 assert.equal(result.projectRef,valid.expectedRef);
 assert.equal(result.url,'https://abcdefghijklmnopqrst.supabase.co');
});
test('current class management production project is explicitly rejected',()=>{
 assert.throws(()=>validateStagingReadOnlyTarget({...valid,url:'https://maqxyvqayilmibdrkmxu.supabase.co/',expectedRef:'maqxyvqayilmibdrkmxu'}),/生产/);
});
test('staging guard fails closed for malformed, redirected or insecure URLs',()=>{
 for(const url of ['http://abcdefghijklmnopqrst.supabase.co/','https://evil.example.com/','https://abcdefghijklmnopqrst.supabase.co/custom','https://u:p@abcdefghijklmnopqrst.supabase.co/','https://abcdefghijklmnopqrst.supabase.co/?leak=1']){
  assert.throws(()=>validateStagingReadOnlyTarget({...valid,url}));
 }
});
test('staging explicit mode, ref and class scope cannot be guessed or reused',()=>{
 for(const bad of [
  {...valid,mode:'WRITES_ENABLED'},
  {...valid,expectedRef:'notthestagingproject'},
  {...valid,otherClassId:valid.classId},
  {...valid,classId:'bad-id'},
  {...valid,publishableKey:'sb_secret_not_allowed'},
  {...valid,publishableKey:'service_role'}
 ])assert.throws(()=>validateStagingReadOnlyTarget(bad));
});
