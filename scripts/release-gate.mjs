import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'release-readiness.json'),'utf8'));
const ids=['react_ci','safe_preview','isolated_postgres','supabase_staging','auth_rls','attendance_flow','security_review','recovery','device_acceptance','formal_deployment'];
const allowed=new Set(['passed','blocked','not_tested']);
if(manifest.schema_version!==1||!Array.isArray(manifest.requirements))throw Error('上线验收台账格式错误');
const seen=new Set();
for(const row of manifest.requirements){
 if(!ids.includes(row.id)||seen.has(row.id)||!allowed.has(row.status))throw Error('验收项目不合法或重复: '+row.id);
 seen.add(row.id);
 if(row.status==='passed'){
  if(!Array.isArray(row.evidence)||!row.evidence.length||row.evidence.some(url=>typeof url!=='string'||!/^https:\/\/github\.com\//.test(url)))throw Error('已通过项目缺少可核实构建记录: '+row.id);
 }else if(typeof row.reason!=='string'||row.reason.trim().length<4)throw Error('未通过项目必须说明阻断原因: '+row.id);
}
if(ids.some(id=>!seen.has(id)))throw Error('正式版必需验收项目缺失');
const pending=manifest.requirements.filter(r=>r.status!=='passed');
const names={passed:'已具备证据',blocked:'阻断',not_tested:'待实测'};
console.log('# V7 正式版上线门槛');
console.log('');
console.log('**当前判定：'+(pending.length?'尚不能上线':'验收台账齐全，仍需人工复核批准')+'**');
console.log('统计：'+manifest.requirements.filter(r=>r.status==='passed').length+' 项已具备证据；'+pending.length+' 项未满足。此统计不是研发进度百分比。');
console.log('');
for(const r of manifest.requirements)console.log('- ['+names[r.status]+'] '+r.name+(r.reason?' — '+r.reason:''));
console.log('');
console.log('注意：仅检查人工维护的台账和证据链接格式，并不自动验证 Supabase 权限、数据库状态或人工验收结果。正式发布必须通过独立审批。');
if(process.argv.includes('--require-ready')&&pending.length){console.error('RELEASE BLOCKED: '+pending.length+' required acceptance items are not satisfied.');process.exitCode=1}
