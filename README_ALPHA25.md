# 智慧班级工作台 V7.0 Alpha 25 · 账号遮罩与前台权限复核

## 本阶段实改

1. `src/App.tsx`：用户身份与已加载数据的所属账号不一致时，立即返回“切换登录身份”遮罩，避免 React effect 清理前短暂显示旧账号学生数据。
2. `src/App.tsx`：移动设备后台恢复／浏览器重新获得焦点时重新调用现有 `verifiedRefresh` 授权校验，校验失败仍沿用 Alpha 22 的清敏感数据、禁止写入逻辑。
3. 复核触发限制：仅已登录且账号身份一致、页面可见、当前没有执行前台复核时运行；重复焦点事件间隔不足 60 秒不重复调用。
4. `src/lib/snapshot-policy.mjs`：增加可独立测试的 `shouldRevalidateForeground` 判断。
5. `tests/alpha25-foreground-auth.test.mjs`：新增 8 项回归测试，旧 84 项继续保留。

## 使用及保护边界

- **本包属于源码版本，不是线上部署包**。现有 Supabase 与 GitHub 均未修改，环境默认不开启业务写入。
- 前台复核不是持续实时的权限撤销监听；服务器 RLS 仍是最终权限边界。实际断网时会显示权限未确认并禁止写入。
- 未通过 npm 安装／TypeScript 全量类型检查／Vite 生产构建／真实浏览器 E2E 测试，不可宣称可上线。
- 在有 npm 网络的环境运行 `npm install && npm test && npm run build`；不要把 `service_role` / secret key 写到 `.env.local`。
- 原 `sql/alpha9_PROPOSED_NOT_APPLIED.sql` 是历史方案，**不要未经评估直接执行到正式库**。

## 本阶段的可复现测试

- `node --test tests/*.test.mjs`：92 项断言通过。
- `node tests/source-contract.mjs`：19 项检查通过。
- `node scripts/offline-preflight.mjs`：31 处相对模块路径通过。
- 本机全局 TypeScript `transpileModule`：11 个 TS/TSX 文件语法转换成功；不能替代依赖齐全后的 `tsc -b`。
