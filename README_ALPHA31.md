# V7.0 Alpha 31 — 切班与权限复核竞态修复

## 本轮实际变更

- `src/App.tsx`：手动切换班级时同时作废旧班级业务读取请求与尚未返回的权限复核请求；结束旧权限复核遮罩，不再允许迟到结果把班级选择改回去。
- `src/lib/authorization-race.mjs`：统一递增两类请求版本序号，避免只取消业务请求、遗漏权限复核请求。
- `src/App.tsx`：登录身份变化后重置前台复核防抖时间，避免上一账号的 60 秒窗口影响新账号。
- `tests/alpha31-class-switch-race.test.mjs`：增加延迟返回、连续切班、非法版本、页面接线与跨账号防抖等测试。
- `tests/alpha20-snapshot.test.mjs`：将过时的单语句源码检查改为检查新增的双重请求失效逻辑。

## 使用和发布边界

- 此包为 React/Vite **开发源码**，不是已构建部署的正式系统。
- `.env.example` 应复制为 `.env.local` 并填写 Supabase 公共 URL 和 publishable key；不能把 service_role 密钥写到浏览器。
- 默认关闭写入；不要在未验收真实班主任和班干部账户及服务器事务前将 `VITE_ENABLE_WORKFLOW_WRITES` 改为 `true`。
- 安装依赖后依次执行 `npm ci`（需要先生成并提交可信的 lockfile）、`npm test`、`npm run verify:source`、`npm run build`，再执行浏览器和真实账户测试。**当前压缩包没有 `package-lock.json`**，首次可使用 `npm install` 生成，并在锁定依赖后使用 `npm ci`。
- 不要直接覆盖旧版 V6 正式业务，也不要把本阶段 SQL 草案直接执行到线上项目。

## 当前阻碍

环境无法解析 `registry.npmjs.org`，没有完整依赖缓存；执行 `npm run build` 报 TS2688 缺少 `vite/client`，因此生产构建、React 运行和手机/电脑浏览器回归均尚未验收。
