import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('../scripts/publish-test-branch.ps1',import.meta.url),'utf8');
test('Alpha35 uploads only to isolated test branch',()=>{
 assert.match(script,/test\/v7-build-verification/);
 assert.match(script,/git push origin \$branch/);
 assert.doesNotMatch(script,/git push origin main/);
});
test('Alpha35 keeps local env file intact while excluding credentials',()=>{
 assert.match(script,/\$allowedDirectories = @\(/);
 assert.match(script,/\$allowedRootFiles = @\(/);
 assert.match(script,/\$p -ne '\.env\.example'/);
 assert.match(script,/node_modules\|dist/);
 assert.match(script,/Remove-Item -LiteralPath \$staging/);
 assert.doesNotMatch(script,/Remove-Item.*\.env\.local/);
});
test('Alpha35 validates staged paths and scans privileged keys',()=>{
 assert.match(script,/git diff --cached --name-only/);
 assert.match(script,/Is-SafeProjectPath \$path/);
 assert.match(script,/sb_secret_\[A-Za-z0-9_-\]/);
 assert.match(script,/git diff --cached --check/);
});
