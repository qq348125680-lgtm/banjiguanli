/** Guard before ANY staging Auth request. This is defensive routing, not
 * authorization. All runtime checks use synthetic accounts in an isolated DB.
 */
const knownProductionRef='maqxyvqayilmibdrkmxu';
const validUuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function validateStagingReadOnlyTarget(config){
 if(config.mode!=='READ_ONLY_SYNTHETIC')throw Error('缺少独立测试环境显式确认，拒绝发起访问');
 let url;
 try{url=new URL(config.url??'')}catch{throw Error('测试项目 URL 不合法')}
 const match=/^([a-z0-9]{20})\.supabase\.co$/.exec(url.hostname);
 if(url.protocol!=='https:'||!match||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('只允许独立 Supabase 项目根地址');
 const projectRef=match[1];
 if(projectRef===knownProductionRef)throw Error('拒绝连接现有班级管理生产 Supabase 项目');
 if(config.expectedRef!==projectRef)throw Error('指定测试项目与 URL 不匹配');
 if(!validUuid(config.classId)||!validUuid(config.otherClassId)||config.classId===config.otherClassId)throw Error('需要两个不同的虚构班级 UUID');
 if(typeof config.publishableKey!=='string'||!config.publishableKey.trim()||/service_role|sb_secret_/i.test(config.publishableKey))throw Error('不得使用 service_role / secret key');
 return {url:url.origin,projectRef,classId:config.classId,otherClassId:config.otherClassId};
}
