# Alpha 24：实际授权班级读取闸门

## 修复内容
- 读取和写入都需要在**当前已验证授权班级清单**中匹配 `classId`，不再仅检查 `authorizationBlocked`。
- 授权复核成功后使用这一次服务端返回的班级 ID 清单，而非依靠 React 旧闭包里的授权状态，避免放行不属于该清单的班级。
- 学生业务档案入口也在发起查询前检查班级授权及复核状态。
- 为清单缺失、授予其他班级、复核覆盖但班级未授权等场景添加测试。

## 可复现测试
```bash
npm test
npm run verify:source
npm run preflight:offline
```
本次执行 84/84 个 Node 测试通过；19/19 静态约束通过；31 处相对文件引用通过；本机 TypeScript 编译器完成 TS/TSX **语法解析**，无解析错误。

## 尚未验收
- 本工作环境缺少 node_modules、package-lock.json；`npm install --offline` 返回 ENOTCACHED，缺少 `@supabase/supabase-js` 缓存。
- 尚未完成 Vite 生产构建、完整 TypeScript 语义类型检查、浏览器 UI 运行及手机/桌面回归。
- 未部署 GitHub，未执行 Supabase SQL，更未修改学生数据。业务写入仍默认为关闭。
- 原有数据库存在的高权限函数风险必须在部署前审查；本次没有批量修改旧函数。

## 实际上线所需步骤（在可联网电脑/CI 中）
1. `npm install`；生成并提交 package-lock.json，确保依赖版本可复现。
2. `npm run build`；修复全部 TS/构建错误后才能进行后续验收。
3. 在独立测试环境执行审查过的事务 SQL，测试班主任/班干部/被停用账号的 RLS 和 RPC。
4. 进行手机与桌面浏览器回归及数据备份恢复测试；通过后再分阶段启用写入。
