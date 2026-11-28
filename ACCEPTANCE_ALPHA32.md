# Alpha 32 实际验收

- `npm test`：125/125 通过。
- `npm run verify:source`：通过（原有检查）。
- `npm run preflight:offline`：34 处本地导入路径通过。
- `npm install`：失败，`EAI_AGAIN registry.npmjs.org`。
- `npm run build`：失败，`TS2688 Cannot find type definition file for vite/client`，因缺依赖不能继续。
- `.github/workflows/build-verification.yml`：已新增**但未实际在 GitHub 执行**。
- 未执行浏览器端到端验收、双账号 RLS 验收、数据库迁移或真实事务测试。
- 本版本未更改线上 GitHub 仓库、Supabase 数据或学生资料。
