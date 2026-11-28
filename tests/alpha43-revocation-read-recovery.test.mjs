import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {withReadDeadline} from '../src/lib/read-deadline.mjs';

test('Alpha43 bounded read completes normally and preserves value',async()=>{
 const payload={items:[{id:'safe'}]};
 assert.equal(await withReadDeadline(async()=>payload,100),payload);
});
test('Alpha43 bounded read distinguishes stalled network from legitimate zero records',async()=>{
 await assert.rejects(()=>withReadDeadline(()=>new Promise(()=>{}),25),/读取超时/);
 assert.deepEqual(await withReadDeadline(async()=>[],100),[]);
});
test('Alpha43 read failure propagates without fabricating an empty success',async()=>{
 await assert.rejects(()=>withReadDeadline(async()=>{throw Error('access denied')},100),/access denied/);
 await assert.rejects(()=>withReadDeadline(()=>Promise.resolve([]),0),/读取超时参数不合法/);
});
test('Alpha43 revoked class authorization unmounts all sensitive child modules',()=>{
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 const deny=app.indexOf('if(user&&(authorizationBlocked||(classId&&!isAuthorizedClass)))return');
 const open=app.indexOf('return <div className="shell">');
 assert.ok(deny>0&&open>deny,'fail-closed early return must precede all private UI');
 assert.match(app,/防止显示旧授权的数据/);
 assert.match(app,/重新验证授权/);
});
test('Alpha43 all scoped read panels use bounded promises and sequence guards',()=>{
 for(const name of ['ClassRecordsPanel','ClassOrganizationPanel','PointRulesPanel','StudentDossierPanel']){
  const source=readFileSync(new URL('../src/components/'+name+'.tsx',import.meta.url),'utf8');
  assert.match(source,/withReadDeadline/);
  assert.match(source,/seq.current/);
  assert.match(source,/return \(\)=>\{seq.current\+\+\}/);
 }
});
