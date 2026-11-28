# V7 正式版：独立 Supabase 真实登录与只读权限验收

**执行状态：工具已经提交，尚未运行实际 Supabase 三账号验收。** 本文不是上线通过证明，也不是将 GitHub Pages 公开技术预览改成正式系统的操作指南。

## 为什么必须这样测

隔离 PostgreSQL 自动测试（SQL/RLS/并发/回滚）已通过，但不能替代真正 Supabase Auth 身份令牌、PostgREST 公开函数权限、班主任与班干部的登录及跨班越权验证。正式版最小可用业务必须先通过这些测试。

## 不修改正式系统的准备顺序

1. **建立独立 Supabase 测试项目或开发分支。** 可能产生费用，必须先确认成本。不使用现有的班级管理生产项目作为测试环境，也不复制真实学生资料/家长信息。
2. 独立测试项目必须有与 V7 方案相符的表、RLS 策略及 `sql/alpha45_STAGING_ONLY_SAFE_MIGRATION.sql`；执行前先用 `sql/alpha45_PREFLIGHT_READONLY.sql` 核验结构，并确保所有数据是自行生成的虚构测试数据。
3. 在测试项目的 Supabase Auth 建立**三名相互独立**的测试账号：A 班班主任、A 班已启用班干部、无 A 班授权的无关账号。设置不同的测试班 A 和测试班 B UUID；A 班至少 2 个、最多 300 个虚构学生。A 班干部不得同时是 A 班班主任，也不得拥有 B 班的授权。**必须在 A 班预先准备至少两名虚构在读学生，以及两条虚构申请：一条由当前测试干部提交，一条由另一名虚构干部提交**（仅在隔离库造样本）。用于同时证明：班主任能读取学生、干部能读取自己的申请、干部不能读取他人申请。不允许靠空表“通过”权限测试。
4. 在 GitHub 仓库的 `v7-staging` **Environment secrets** 中安全配置以下变量（绝不要放进公开仓库、issue、聊天消息、构建日志或客户端 Vite 环境变量）：

| Secret | 用途 |
| --- | --- |
| `V7_STAGING_URL` | 独立 Supabase 项目 HTTPS API 根地址 |
| `V7_STAGING_EXPECTED_REF` | 项目 ref，必须与 URL 的子域名精确一致 |
| `V7_STAGING_PUBLISHABLE_KEY` | 测试项目浏览器可用 publishable/anon key，绝非 secret/service_role |
| `V7_STAGING_CLASS_ID` | 虚构 A 班 UUID |
| `V7_STAGING_OTHER_CLASS_ID` | 虚构 B 班 UUID |
| `V7_STAGING_OWNER_EMAIL` / `V7_STAGING_OWNER_PASSWORD` | 测试班主任 |
| `V7_STAGING_CADRE_EMAIL` / `V7_STAGING_CADRE_PASSWORD` | 测试班干部 |
| `V7_STAGING_OUTSIDER_EMAIL` / `V7_STAGING_OUTSIDER_PASSWORD` | 无关测试账号 |

5. 验收运行入口：当前安全工作流仍只保存在 `test/v7-build-verification` 分支，GitHub 的 `workflow_dispatch` 按官方规则须在默认分支有同名工作流才能显示“Run workflow”按钮。为**不修改 main 分支**，此工作流同时支持仅对明确命名的 Git tag `v7-staging-check-*` 触发。配置上述 secrets 后，将该前缀的标签指向**已审核的 V7 测试分支提交**并推送即可启动一次验收（不要创建指向 main 的标签）：`git tag v7-staging-check-<日期或编号> <已审查的测试提交SHA>`，`git push origin v7-staging-check-<日期或编号>`。工作流仅对指定标签触发，不跟随普通分支推送运行。**任何形式都不会自动执行业务写入。**
6. 验收查询账号归属、授权班级、有限字段花名册、只读申请记录，并且**直接查询**学生表、班干部表和申请表的七条高风险 RLS 路径；同时使用已预置的“其他干部申请”核实班干部不能读取他人记录。跨班级、无授权、未登录调用 RPC 必须返回错误。未知网络错误不能冒充权限已拒绝，任何一项失败都阻止标记验收通过。
7. 只记录 GitHub Actions 运行链接、三种账号的测试结论和必要的脱敏汇总。验证过后及时停用测试账号、销毁不再使用的独立测试资源，防止产生持续费用。

## 防误连接保护

- `V7_STAGING_MODE` 必须精确为 `READ_ONLY_SYNTHETIC`；只允许 `https://<20字符ref>.supabase.co/` 根地址。
- 会强制排除目前现有的班级管理生产项目 ref `maqxyvqayilmibdrkmxu`，项目 URL、ref 与两个班级 UUID 必须匹配规则。
- 所有读取基于 Supabase Auth、RLS 和 `v7_cadre_roster` RPC 的实际响应，不使用 service_role，也不访问真实学生名单。
- 验证脚本不包含 INSERT/UPDATE/DELETE/UPSERT、考勤审批 RPC 或自动补发请求；仅执行测试账号登录、只读访问及登出。
- 本脚本是**登录与只读权限第一道验收**，不能代替单独的写入/审核原子事务、用户权限撤销、手机实机、生产备份和正式发布审批。

## 验收过后怎么推进

按顺序：三账号真实只读验收成功 → 在独立测试项目使用虚构学生进行单条考勤提交与审批 → 停用干部、双端并发、断网重试、跨班安全及数据恢复 → 满足 `release-readiness.json` 所有门槛 → 经人工审查后设计正式版入口和回退。任何阶段失败都保持原系统不变。
