# Alpha 22 验收记录（2026-11-27）

## 本次实测
- `npm test`：73/73 通过。
- `npm run verify:source`：19/19 源码契约断言通过。
- `npm run preflight:offline`：31 处相对模块导入路径有效。
- TypeScript `transpileModule`：12 个常规 TS/TSX 文件语法转换通过；此检查不等于全量类型检查。
- `npm run build`：**失败**，`TS2688 Cannot find type definition file for vite/client`，本机未安装 Vite 依赖。npm 官方 registry DNS `EAI_AGAIN`。
- 不具备浏览器真实运行 / 双账号验收 / 数据库事务入账验收条件。

## 修改范围
- 授权复核失败时清空学生名单、审核记录、日志、待审核数量、档案与操作反馈，并禁止写入。
- 使所有旧数据请求序号失效，避免失败后回填。
- 无可访问班级提示改走完整授权复核。
- 首次为空班级选择时不误判为已有授权被撤销；曾选择的班级被撤销时仍保持阻断。
- 没有修改数据库 SQL 或线上系统。

## 后续上线门槛
1. 在可访问 npm registry 的环境安装锁定依赖、生成并提交 lockfile；执行完整 TypeScript、Vite 构建。
2. 用班主任和班干部两种真实账号测试授权撤销、刷新、登出、跨班与网络异常。
3. 在隔离库中测试审核事务与入账；未验证前保持 `VITE_ENABLE_WORKFLOW_WRITES=false`。
4. 对手机/电脑分别进行浏览器回归；确认所有旧版必需业务存在回退路径。
