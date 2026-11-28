import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
test('dist gate rejects missing build outputs',()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'v7-dist-'));
 try{const r=spawnSync(process.execPath,['scripts/verify-dist.mjs'],{cwd:root,env:{...process.env,V7_DIST_DIR:dir},encoding:'utf8'});assert.notEqual(r.status,0)}finally{rmSync(dir,{recursive:true,force:true})}
});
test('dist gate accepts complete emitted assets',()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'v7-dist-'));
 try{mkdirSync(path.join(dir,'assets'));writeFileSync(path.join(dir,'index.html'),'<html><script type="module" src="/assets/main.js"></script></html>');writeFileSync(path.join(dir,'assets','main.js'),'console.log(1)');const r=spawnSync(process.execPath,['scripts/verify-dist.mjs'],{cwd:root,env:{...process.env,V7_DIST_DIR:dir},encoding:'utf8'});assert.equal(r.status,0,r.stderr)}finally{rmSync(dir,{recursive:true,force:true})}
});
test('dist gate rejects missing referenced asset',()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'v7-dist-'));
 try{writeFileSync(path.join(dir,'index.html'),'<html><script src="/assets/main.js"></script></html>');const r=spawnSync(process.execPath,['scripts/verify-dist.mjs'],{cwd:root,env:{...process.env,V7_DIST_DIR:dir},encoding:'utf8'});assert.notEqual(r.status,0)}finally{rmSync(dir,{recursive:true,force:true})}
});

function runGateForBundle(bundleText){
 const dir=mkdtempSync(path.join(os.tmpdir(),'v7-dist-security-'));
 try{
  mkdirSync(path.join(dir,'assets'));
  writeFileSync(path.join(dir,'index.html'),'<html><script type="module" src="/assets/main.js"></script></html>');
  writeFileSync(path.join(dir,'assets','main.js'),bundleText);
  return spawnSync(process.execPath,['scripts/verify-dist.mjs'],{cwd:root,env:{...process.env,V7_DIST_DIR:dir},encoding:'utf8'});
 } finally {rmSync(dir,{recursive:true,force:true})}
}
test('dist gate permits instructional warning about service_role without a credential',()=>{
 const result=runGateForBundle('console.log("Never put secret/service_role keys into your public frontend");');
 assert.equal(result.status,0,result.stderr);
});
test('dist gate rejects embedded Supabase secret key shape',()=>{
 const result=runGateForBundle('const key="sb_secret_1234567890abcdefghijklmnopqrstuvwxyz";');
 assert.notEqual(result.status,0);
});
test('dist gate rejects embedded privileged role assignment',()=>{
 const result=runGateForBundle('const env="service_role=eyJhbGciOiJIUzI1NiJ9";');
 assert.notEqual(result.status,0);
});
test('dist gate rejects public key placeholder embedded in JS',()=>{
 const result=runGateForBundle('const key="YOUR_PUBLIC_PUBLISHABLE_KEY";');
 assert.notEqual(result.status,0);
});
