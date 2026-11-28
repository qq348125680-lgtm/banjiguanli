import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {validateStagingReadOnlyTarget} from '../src/lib/staging-target-guard.mjs';
import {createReadOnlyBridge} from '../src/lib/supabase-readonly-adapter.mjs';
import {createSafeWorkflow} from '../src/lib/safe-workflow.mjs';

// Deliberately no INSERT, UPDATE, DELETE, UPSERT or audit writes.
// Never log account credentials, tokens, student names or private rows.
const env=process.env;
const config=validateStagingReadOnlyTarget({
 mode:env.V7_STAGING_MODE,
 url:env.V7_STAGING_URL,
 expectedRef:env.V7_STAGING_EXPECTED_REF,
 publishableKey:env.V7_STAGING_PUBLISHABLE_KEY,
 classId:env.V7_STAGING_CLASS_ID,
 otherClassId:env.V7_STAGING_OTHER_CLASS_ID
});
const authAccounts=[
 ['owner',env.V7_STAGING_OWNER_EMAIL,env.V7_STAGING_OWNER_PASSWORD],
 ['cadre',env.V7_STAGING_CADRE_EMAIL,env.V7_STAGING_CADRE_PASSWORD],
 ['outsider',env.V7_STAGING_OUTSIDER_EMAIL,env.V7_STAGING_OUTSIDER_PASSWORD]
];
for(const [role,email,password] of authAccounts){
 if(typeof email!=='string'||!email.includes('@')||typeof password!=='string'||password.length<8)
  throw Error('缺少 '+role+' 对应的独立测试账号，测试已停止');
}
const openClient=()=>createClient(config.url,env.V7_STAGING_PUBLISHABLE_KEY,{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
const owner=openClient(),cadre=openClient(),outsider=openClient(),anon=openClient();
const clients=[owner,cadre,outsider];
try{
 const ids=[];
 for(let i=0;i<authAccounts.length;i++){
  const [role,email,password]=authAccounts[i];
  const {data,error}=await clients[i].auth.signInWithPassword({email,password});
  if(error||!data?.user?.id)throw Error('独立测试账号 '+role+' 登录失败，停止验收');
  ids.push(data.user.id);
 }
 assert.equal(new Set(ids).size,3,'三个测试账号必须相互独立');
 const ownerReader=createReadOnlyBridge(owner),cadreReader=createReadOnlyBridge(cadre),outsiderReader=createReadOnlyBridge(outsider);
 const ownerClasses=await ownerReader.authorizedClasses();
 assert.ok(ownerClasses.owned.some(c=>c.id===config.classId),'测试班主任未拥有指定 A 班');
 const cadreClasses=await cadreReader.authorizedClasses();
 assert.ok(cadreClasses.delegated.some(c=>c.class_id===config.classId),'测试班干部未被启用授权到指定 A 班');
 assert.ok(!cadreClasses.owned.some(c=>c.id===config.classId),'班干部账号不应兼有目标班班主任身份');
 assert.ok(!cadreClasses.delegated.some(c=>c.class_id===config.otherClassId),'班干部不应得到指定 B 班授权');
 const outsiderClasses=await outsiderReader.authorizedClasses();
 assert.ok(!outsiderClasses.owned.some(c=>c.id===config.classId)&&!outsiderClasses.delegated.some(c=>c.class_id===config.classId),'无关账号意外拥有 A 班权限');
 console.log('PASS: 三个独立测试账号可登录，班主任与班干部的授权范围符合预期');
 const ownerRoster=await createSafeWorkflow(owner).roster(config.classId);
 const cadreRoster=await createSafeWorkflow(cadre).roster(config.classId);
 assert.ok(Array.isArray(ownerRoster)&&Array.isArray(cadreRoster),'RPC 返回了不合法的测试花名册');
 assert.ok(ownerRoster.length>=2 && ownerRoster.length<=300,'测试班至少应有两名、最多300名虚构学生');
 assert.deepEqual(new Set(cadreRoster.map(r=>r.student_id)),new Set(ownerRoster.map(r=>r.student_id)),'班干部花名册与班主任不一致');
 const allowed=new Set(['student_id','student_no','student_name']);
 for(const row of [...ownerRoster,...cadreRoster]){
  assert.ok(row.student_id&&typeof row.student_name==='string','测试花名册缺少必要字段');
  assert.ok(Object.keys(row).every(k=>allowed.has(k)),'花名册 RPC 泄漏了超出允许范围的字段');
 }
 console.log('PASS: A 班花名册仅含学号、姓名、学生 UUID；不同账号结果一致');
 const prohibited=[
  ['跨班',await cadre.rpc('v7_cadre_roster',{p_class_id:config.otherClassId})],
  ['无关账号',await outsider.rpc('v7_cadre_roster',{p_class_id:config.classId})],
  ['未登录账号',await anon.rpc('v7_cadre_roster',{p_class_id:config.classId})]
 ];
 for(const [label,result] of prohibited)assert.ok(result.error,'未阻止 '+label+' 调用花名册 RPC');
 console.log('PASS: 跨班、无关账号及未登录账号均被服务端拒绝');
 const ownRecords=await ownerReader.submissionsForOwner(config.classId,{page:1,pageSize:5});
 const cadreRecords=await cadreReader.mySubmissions(config.classId,{page:1,pageSize:5});
 assert.ok(Array.isArray(ownRecords.items)&&Array.isArray(cadreRecords.items),'业务记录读取失败');
 assert.ok(cadreRecords.items.every(r=>r.class_id===config.classId),'干部记录越过了班级范围');
 console.log('PASS: 班主任与班干部可在授权范围安全读取申请记录');
 console.log('STAGING READ-ONLY ACCEPTANCE PASS. No business writes executed.');
}finally{
 await Promise.allSettled(clients.map(c=>c.auth.signOut()));
}
