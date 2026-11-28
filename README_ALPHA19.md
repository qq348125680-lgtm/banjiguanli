# 智慧班级工作台 V7.0 Alpha 19 — 真实构建排障和账号状态隔离

本包直接以 Alpha18 源码迭代，**不是已部署版本**。

## 实际修改
- 登录账户 UID 变化时立刻清除上一账号缓存的班级、学生、审核、操作日志、档案、待审核数字及操作反馈。
- 同时使上一账号正在执行的授权查询和业务查询失效，防止迟到的网络响应恢复旧状态。
- 不以刷新 JWT 对象替代用户 ID 的方式判定账号变更。
- 新增 `sql/alpha19_RELEASE_PREFLIGHT_READONLY.sql` 上线前只读检查脚本，核对 RLS、RPC 权限、考勤唯一约束、匿名可调用 SECURITY DEFINER 函数数量。
- 保留默认写入关闭及全部 Alpha18 功能。

## 验收结果（本次环境）
- `node --test tests/*.test.mjs`: 53 项通过。
- `node tests/source-contract.mjs`: 19 项约束断言通过。
- `npm install`: **失败**，npm registry DNS 返回 EAI_AGAIN；无法验证生产构建。
- 未完成真实班主任/班干部双账号验收，也未部署 SQL。
- 未触碰 Supabase 线上表、记录、权限及 GitHub 仓库。

## 运行步骤（需 npm 网络可达）
1. 解压工程并运行 `npm install`。
2. 运行 `npm run test`、`npm run verify:source`、`npm run build`。
3. 将 `.env.example` 复制为 `.env.local`，只填 public URL/publishable key，严禁 service_role。
4. 在隔离的测试项目里先应用并核验 Alpha9 SQL 草案，再以真实班主任和班干部账号验收。
5. 真实事务和跨账号权限全部通过前，保持 `VITE_ENABLE_WORKFLOW_WRITES=false`；绝不直接替换线上旧版。
