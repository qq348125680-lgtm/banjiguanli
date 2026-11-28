# V7 Alpha 32 — 构建验证流水线与切班加载状态修复

本版本以 Alpha 31 为基础，新增 GitHub Actions 的 **测试+TypeScript+Vite 构建验证**，并修正切换账号/班级时旧请求被作废、却可能留下全局 `loading` 状态的情况。

## 运行验收

- 本地 Node 测试：`npm test`
- 静态约束：`npm run verify:source`
- 本地导入检查：`npm run preflight:offline`
- 实际构建：先安装依赖，然后 `npm run build`。
- 当前本地执行 `npm install` 遇到 `EAI_AGAIN` DNS 错误，**不能声称构建成功**。

## GitHub Actions

把此项目**根目录的内容**上传至独立的 V7 测试分支或仓库，在 GitHub Actions 中手工运行 `V7 build verification (no deployment)`，或通过 PR 触发。它将安装依赖、生成可供审阅的 `package-lock.json`、执行测试、构建 `dist/`，并保存构建产物。

该工作流 **不会部署到线上**、不会连接真实 Supabase、不会执行数据库迁移。CI 环境变量使用无效的占位公开凭据，正式业务写入明确关闭。构建成功后应审查 `package-lock.json` 并提交到源码仓库，随后将工作流改成 `npm ci` 实现稳定依赖锁定。

## 安全边界

真实班级数据和线上 Supabase 未更改。生产构建、真实双账号权限、审批事务和浏览器回归仍需实际验收。不能把 CI 工作流“已编写”等同于“CI 构建已通过”。
