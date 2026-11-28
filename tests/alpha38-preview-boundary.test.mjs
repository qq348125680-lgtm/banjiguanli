import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const pages=readFileSync(new URL('../.github/workflows/pages-safe-preview.yml',import.meta.url),'utf8');
const client=readFileSync(new URL('../src/lib/client.ts',import.meta.url),'utf8');

test('Alpha38 public technical preview is clearly labelled as no-database and non-operational',()=>{
 assert.match(app,/Alpha 38 · 安全技术预览/);
 assert.match(app,/import\.meta\.env\.PROD\?/);
 assert.match(app,/暂不能登录、读取学生信息或登记考勤/);
 assert.match(app,/正式业务请继续使用原有系统/);
});

test('Alpha38 public pages build cannot connect to real Supabase',()=>{
 assert.match(pages,/VITE_SUPABASE_URL: ''/);
 assert.match(pages,/VITE_SUPABASE_PUBLISHABLE_KEY: ''/);
 assert.match(pages,/VITE_ENABLE_WORKFLOW_WRITES: 'false'/);
 assert.match(pages,/no live DB config/);
});

test('Alpha38 browser requires valid public config and defaults to no writes',()=>{
 assert.match(client,/configured=Boolean\(url&&key/);
 assert.match(client,/VITE_ENABLE_WORKFLOW_WRITES==='true'/);
});

test('Alpha38 public preview does not put local .env setup instructions in production message',()=>{
 assert.match(app,/import\.meta\.env\.PROD\?"公网部署已成功/);
 assert.match(app,/:"本地尚未配置 Supabase/);
});
