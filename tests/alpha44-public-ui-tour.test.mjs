import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('Alpha44 public tour explicitly contains no student records, database client or writes',()=>{
 const preview=readFileSync(new URL('../src/components/SafePreviewWorkspace.tsx',import.meta.url),'utf8');
 assert.match(preview,/不含模拟学生和虚构业务记录/);
 assert.match(preview,/<StudentsPanel students=\{\[\]\}/);
 assert.match(preview,/无法读取不显示为零/);
 assert.match(preview,/数据库访问、身份认证及业务写入均不可用/);
 assert.doesNotMatch(preview,/\.insert\(|\.update\(|\.delete\(|\.rpc\(|fetch\(|from\(['\"]@supabase/i);
});
test('Alpha44 layout tour includes six functional navigation entries and mobile controls',()=>{
 const src=readFileSync(new URL('../src/components/SafePreviewWorkspace.tsx',import.meta.url),'utf8');
 for(const tab of ["工作台","学生中心","考勤登记","审核中心","班务记录","值日管理","事件中心","用户关系"])assert.ok(src.includes(tab));
 assert.match(src,/setMobile\(true\)/);
 assert.match(src,/bottom-nav/);
 assert.match(src,/onExit/);
 assert.match(src,/record-tabs/);
});
test('Alpha44 no-db page offers safe interactive layout without connecting',()=>{
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 assert.match(app,/if\(!configured\)return previewLayout\?<SafePreviewWorkspace/);
 assert.match(app,/查看各模块界面布局（无数据）/);
 assert.match(app,/setPreviewLayout\(true\)/);
 assert.match(app,/setPreviewLayout\(false\)/);
 const workflow=readFileSync(new URL('../.github/workflows/pages-safe-preview.yml',import.meta.url),'utf8');
 assert.match(workflow,/VITE_SUPABASE_URL: ''/);
 assert.match(workflow,/VITE_ENABLE_WORKFLOW_WRITES: 'false'/);
});
