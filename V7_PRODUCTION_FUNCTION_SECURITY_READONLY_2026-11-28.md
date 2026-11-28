# V7 正式版 · 生产数据库 SECURITY DEFINER 函数只读清点

核对日期：2026-11-28，来源：现有班级管理 Supabase 项目的 `pg_proc` / `pg_namespace` 系统元数据，只做 SQL SELECT。**没有访问学生、家长或业务记录，也没有修改任何权限、函数、策略或正式数据。**

## 核查结果（角色 EXECUTE 权限，不是漏洞定性）

| 统计 | 数量 |
| --- | ---: |
| `public` 下 `SECURITY DEFINER` 函数总数 | 35 |
| 匿名角色（`anon`）可执行 | 19 |
| 已登录角色（`authenticated`）可执行 | 33 |
| 上述匿名可执行中的返回 `trigger` 类型 | 16 |
| 上述匿名可执行中的非 `trigger` 函数 | **3** |

16 个触发器函数与 3 个普通函数**应分开审计**：触发器函数通常不能像普通 RPC 一样直接从 PostgREST 调用，但函数 EXECUTE 权限仍可能不符合最小权限原则。实际风险应结合函数调用链、数据库角色、API 暴露设置和现有触发器用途判断。这里的数量不是已证实漏洞数量。

## 优先核查的 3 个匿名可执行普通函数

| 函数（只列名称与签名） | 返回类型 | 只读检测到的 `auth.uid` / `auth.jwt` 文字引用 | 需要验证的权限边界 |
| --- | --- | --- | --- |
| `my_class_message_contacts_v470(p_class_id uuid)` | `TABLE(user_id uuid, role text, label text)` | 有 | 未登录、其他班级不得枚举用户标识或联系人标签，登录者只能访问有权班级 |
| `v470_is_class_message_member(p_class uuid, p_user uuid)` | `boolean` | **未检测到** | 传入任意班级/用户 UUID 是否可能泄露成员关系；是否是内部权限辅助函数；是否有上层调用方校验 |
| `v503_my_linked_message_statuses(p_class_id uuid)` | `TABLE(message_id uuid, business_status text)` | 有 | 未登录、跨班账号不能读取其他班级消息或业务状态 |

以上函数均设置了 `search_path`；这**不能替代**审查函数内部的身份校验。特别是 `v470_is_class_message_member` 没有文字形式的 `auth.uid` / `auth.jwt`，仅说明需要优先审查其调用链，**不构成已证实越权漏洞**。

## 按正式版上线优先级的处置原则

1. 在**独立 Supabase 测试项目**运行相同只读元数据核对，再使用无关账号、未登录账号、跨班干部账号验证上述 3 个普通函数的行为。
2. 对于触发器函数：确认其确实 `returns trigger`、关联的表、触发场景，以及是否需要通过 `PUBLIC` 保留 EXECUTE。不可根据名称简单移除。
3. 对于函数体：逐项审查 `SECURITY DEFINER` 运行身份、`auth.uid()` 权限断言、参数 `p_user` 的来源、是否读取其他班级资料和间接调用函数。
4. 任何 `REVOKE EXECUTE`、修改 `SECURITY DEFINER` 或迁移 schema 的操作，先在隔离测试库验证旧系统流程；**不得在现有生产库批量执行**。
5. 完成上述安全复核并保存合格验收证据后，才能考虑把 `release-readiness.json` 的 `security_review` 状态从 `blocked` 改为通过。

## 可重复执行的检查

[SQL（只读目录查询）](sql/v7_SECURITY_DEFINER_INVENTORY_READONLY.sql)

Supabase Security Advisor 的相关告警说明：

- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

**状态：完成了函数分类与优先级清点；尚未完成代码级安全审计和独立账号实测，因此正式版安全门槛仍为阻断。**
