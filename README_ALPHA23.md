# 智慧班级工作台 V7.0 Alpha 23：授权查询闸门修复

## 本轮实际完成

- **权限失败即禁止再次读取**：数据加载入口统一校验当前账号、班级、Supabase 桥接器与 `authorizationBlocked` 状态。无授权或复核失败不再因切换页面、翻页而重新发起学生名单/审核查询。
- **自动授权加载失败也清除敏感快照**：不再只显示错误提示；清空班级选择、学生名单、审核、日志、档案入口与缓存进度，同时使旧请求失效。
- **成功复核才能恢复数据查询**：`verifiedRefresh()` 完成 `authorizedClasses()` 后，以受控参数触发一次读取。参数只来自同一函数内部，不暴露为 UI 的普通操作开关。
- **复核中暂停新的后台数据加载**，避免分页、导航等状态变化引起并发读取。
- 将 Alpha 21/22 的旧源码契约测试更新为验证新的安全调用方式，添加 8 项 Alpha 23 专项测试。

## 测试

- `node --test tests/*.test.mjs`：81/81 通过。
- `node tests/source-contract.mjs`：19/19 通过。
- `node scripts/offline-preflight.mjs`：31 处相对引用存在。
- TypeScript/TSX 普通源码：语法转换通过（此项**不是**完整类型检查）。
- `npm install --offline`：ENOTCACHED，环境没有项目依赖缓存；**未通过** Vite 生产构建。

## 不做出的承诺

本版本没有在线部署、真实账号验收、Supabase 迁移执行，也没有启用正式写入。前端检查不是 RLS 的替代品。继续保留旧版业务。数据库修改前仍需核查已发现的安全警告与事务 SQL。

## 运行

在网络正常的开发机中，把 `.env.example` 复制为 `.env.local`，只填写 Supabase 公共 URL 和 publishable/anon key，执行 `npm install && npm test && npm run verify:source && npm run build && npm run dev`。不要在前端填写 service_role/secret key。默认写入仍关闭。
