import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const manifest=JSON.parse(readFileSync(new URL('../release-readiness.json',import.meta.url),'utf8'));
function run(flag){return spawnSync(process.execPath,['scripts/release-gate.mjs',flag],{cwd:new URL('..',import.meta.url),encoding:'utf8'});}
test('release status remains informational while critical Supabase acceptances are unverified',()=>{
 const result=run('--status');
 assert.equal(result.status,0);
 assert.match(result.stdout,/尚不能上线/);
 assert.match(result.stdout,/Supabase/);
});
test('required release gate fails closed until ALL mandatory checks have evidence',()=>{
 const result=run('--require-ready');
 assert.equal(result.status,1);
 assert.match(result.stderr,/RELEASE BLOCKED/);
});
test('public preview success must not masquerade as production readiness',()=>{
 const ids=manifest.requirements.map(r=>r.id);
 assert.equal(new Set(ids).size,ids.length);
 assert.equal(manifest.requirements.find(r=>r.id==='safe_preview').status,'passed');
 assert.equal(manifest.requirements.find(r=>r.id==='formal_deployment').status,'blocked');
 assert.equal(manifest.requirements.find(r=>r.id==='auth_rls').status,'not_tested');
 assert.equal(manifest.requirements.find(r=>r.id==='attendance_flow').status,'not_tested');
});
