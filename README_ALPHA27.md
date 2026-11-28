# 智慧班级工作台 V7.0 Alpha 27 — 授权复核期间隐私遮罩

本版继续基于 Alpha 26 工程修改，并非独立演示页。

## 本次改动

- 班级授权正在重新校验时，暂时不渲染含学生名单、审核记录、操作日志的主页面，改为明确的“正在验证权限”页面。
- 验证成功后原有 React 内存数据可继续使用，并执行刷新；失败时沿用 Alpha 26 的失效清理和停止写入逻辑。
- 避免手机从后台返回、浏览器重新聚焦或手动刷新时，旧班级信息在校验窗口期间仍留在屏幕上。
- 新增 `tests/alpha27-authorization-mask.test.mjs` 四条源码级回归测试。

## 运行和限制

```sh
npm install
npm test
npm run verify:source
npm run preflight:offline
npm run build
```

- 不要直接覆盖线上旧版或将 `VITE_ENABLE_WORKFLOW_WRITES=true` 用于真实班级。
- 生产构建仍依赖外部 npm 包；本轮在当前环境执行 `npm run build` 失败，原因是 `vite/client` 类型缺失。`npm install --offline` 返回 `ENOTCACHED`。
- 本轮未运行浏览器端到端测试和真实双账号 Supabase 权限测试；没有变更远端数据库。
- 完整源码与 `ACCEPTANCE_ALPHA27.md` 一并交付。
