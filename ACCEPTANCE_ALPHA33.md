# Alpha 33 验收记录（2026-11-27）

## 本地已实际执行
- `npm test`：128/128 通过，包含新增的 3 项 `dist` 校验测试。
- `npm run verify:source`：已通过现有 19 项源码约束断言。
- `npm run preflight:offline`：34 处相对模块导入通过。
- `scripts/verify-dist.mjs`：对于没有 `dist` 的工程，按设计拒绝通过；测试用临时模拟产物校验成功及缺失 JS 校验失败。
- GitHub Actions YAML 可解析，构建流程包含安装依赖、完整测试、Vite 构建、产物核对、HTTP 冒烟及产物上传。

## 尚未完成
- 本地 `npm` registry 访问报 `EAI_AGAIN`，无法下载依赖，因此没有真正的 `dist`，未完成 TypeScript 类型检查、Vite build、HTTP preview 冒烟。
- GitHub 仓库尚未上传本工程，Actions 未执行、没有可以确认的 CI 成功记录。
- 未使用真实班主任/班干部测试账号，不代表 Supabase RLS 和审批事务通过验收。
- 未完成手机和电脑的真实浏览器端到端测试。

## 数据安全
- 本次没有修改 Supabase 数据库、GitHub 仓库或学生数据。
- 生产写入开关关闭，workflow 没有部署步骤。
- 生产 JS 关键字检查是辅助保障，并非全面敏感信息扫描。
