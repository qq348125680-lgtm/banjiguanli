import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../.github/workflows/build-verification.yml',import.meta.url),'utf8');
test('account boundary releases stale global spinner',()=>assert.match(app,/setFeedback\(''\);setProblem\(''\);setPage\(1\);setLoading\(false\)/));
test('class switch releases stale global spinner and error',()=>assert.match(app,/invalidateSelectedClass\(authorizationSeq,requestSeq\);setAuthorizationChecking\(false\);setLoading\(false\);setProblem\(''\)/));
test('CI checks real build instead of source-only pass',()=>{assert.match(workflow,/npm run build/);assert.match(workflow,/test -s dist\/index\.html/)});
test('CI has no deployment and writes are disabled',()=>{assert.match(workflow,/VITE_ENABLE_WORKFLOW_WRITES: 'false'/);assert.doesNotMatch(workflow,/supabase deploy|supabase db push|github-pages|deploy-pages/)});
