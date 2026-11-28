# 智慧班级工作台 V7.0 Alpha 47 — 生产环境只读核对记录

核对日期：2026-11-28（Asia/Shanghai）。**只做元数据查询与 Supabase Security Advisor 读取；没有执行生产库写入、SQL 迁移、账号修改或真实学生资料查询。**

## 已核实的上线阻断项

| 项目 | 生产环境只读检查 | 影响 |
| --- | --- | --- |
| `public.v7_cadre_roster` | 不存在（0 个同名函数） | V7 班干部提交流程无法完成预写入授权核验 |
| `public.v7_review_attendance` | 不存在（0 个同名函数） | V7 原子审批接口无法调用 |
| `v7_pending_student_day_unique` | 不存在（0 个同名索引） | 缺少 V7 计划的并发待审核考勤防重索引 |
| Supabase 测试分支 | 0 个 | 没有可直接用于隔离验收的 Supabase 分支 |

注：函数/索引不在生产库，是**预期的安全隔离状态**，不是要求立刻往生产库安装迁移。不能在当前条件下把 V7 写入开关改为 `true`。

## 基础表与策略的补充只读核对

检查发现以下 **9 项元数据条件全部满足**：

1. `attendance` 表存在。
2. `attendance` 已开启 RLS。
3. `attendance` 存在学生＋日期唯一约束。
4. `cadre_submissions` 已开启 RLS。
5. `submissions_cadre_insert` 插入策略存在。
6. `submissions_teacher` 策略存在。
7. `delegates_self_read` 策略存在。
8. `students.archived_at` 字段存在。
9. `class_delegates.enabled` 字段存在。

当前待审核考勤的重复学生＋班级＋日期组合计数为 **0 组**（仅返回汇总数量，没有查询具体学生）。这些是部署前的基础兼容性检查；**策略存在不等于策略内容安全**，函数执行授权和两账号真实行为仍须验收。

## 安全顾问只读检查

Supabase Security Advisor 在核对时报告：
- `anon_security_definer_function_executable`：19 项高权限函数可由匿名角色调用的 **WARN**。
- `authenticated_security_definer_function_executable`：33 项已登录角色可调用高权限函数的 **WARN**。

这两类是**审查线索，不等同于已经证实数据泄露或权限绕过**；同一函数可同时出现在两类警告中。特别应检查与家校联系方式、干部账户和消息有关的函数是否将鉴权写在函数内部。

**禁止为消除告警而直接批量执行 `REVOKE EXECUTE`、改为 `SECURITY INVOKER` 或修改旧系统 RLS**，否则可能破坏原系统的触发器和现有业务。先在隔离测试环境逐函数确认：用途、调用主体、内部 `auth.uid()` 校验、最小授权与是否必须使用 `SECURITY DEFINER`。

官方参考：
- [匿名角色可执行 SECURITY DEFINER 的警告](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- [已登录角色可执行 SECURITY DEFINER 的警告](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)

## V7 进入真实试运行前的验收门槛

1. 另建**隔离 Supabase 测试项目/分支**，用虚构学生、老师及班干部账号；不得复制明文真实学生资料或生产密钥。
2. 测试项目先安装、检查 `sql/alpha45_STAGING_ONLY_SAFE_MIGRATION.sql`，验证 SQL 回滚与独立备份恢复。
3. 使用两个真实登录的**测试账号**验证同班与跨班 RLS、撤销/停用干部权限、班主任只读家校数据边界。
4. 模拟断网、超时、关闭标签页、切换班级及同一学生双会话并发提交；核对后方可解除锁定，绝不自动重试未知写入。
5. 完成手机触控和电脑端回归、导出字段审查和操作日志核对。
6. 继续保持 `VITE_ENABLE_WORKFLOW_WRITES=false`。所有门槛验收完成后，再按独立发布清单处理正式部署；不能仅根据前端开关或本仓库 Node 单元测试宣称生产可用。

## 可重复执行的生产只读检查

```sql
select 'v7_cadre_roster' as name, count(*)::int as found
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='v7_cadre_roster'
union all
select 'v7_review_attendance', count(*)::int
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='v7_review_attendance'
union all
select 'v7_pending_student_day_unique', count(*)::int
from pg_indexes where schemaname='public'
and indexname='v7_pending_student_day_unique';
```

本记录是**2026-11-28 时点的只读结果**，不应作为未来状态的实时证明。正式系统继续独立运行，V7 仅用于安全技术预览。
