# 智慧班级工作台 V7.0 Alpha 26 — 首屏初始化顺序修复

## 重大修复

在 Alpha 25 的 `src/App.tsx` 中，`fetchDossierPage = useCallback(..., [..., isAuthorizedClass, ...])` 出现在 `const isAuthorizedClass = ...` 声明之前。函数体中的变量引用可以延迟，但 `useCallback` 的依赖数组会在 React 渲染时**立即求值**，因此可能触发 JavaScript `ReferenceError: Cannot access 'isAuthorizedClass' before initialization`，导致整个 App 无法挂载。现在把授权班级 ID 和校验变量移到了回调声明之前。

## 新增检查

`tests/alpha26-render-order.test.mjs` 使用 TypeScript AST 校验：
- 班级授权变量定义先于档案读取回调；
- 授权 ID 列表定义先于授权校验；
- App.tsx 无 TSX 解析错误。

## 执行结果

- `node --test tests/*.test.mjs`：95 项通过。
- `npm run verify:source`：19 项断言通过。
- `npm run preflight:offline`：31 条相对导入路径检查通过。
- 此环境仍无法连通 registry.npmjs.org，未安装项目 `node_modules`；故 **未通过** `npm run build`、完整类型检查及浏览器端到端验收。上述测试不能替代真实运行。

## 运行方式（可访问 npm 的开发电脑）

1. 安装 Node.js 20+（建议 LTS）。
2. 在本工程目录执行 `npm install`，首次安装后保留生成的 `package-lock.json`，后续用 `npm ci`。
3. 复制 `.env.example` 为 `.env.local`，填入现有 Supabase 的公开 URL、publishable/anon key，不可填 `service_role` / secret key。
4. 执行 `npm run test && npm run verify:source && npm run build && npm run dev`。
5. 仅使用测试账号进行班主任和班干部权限验收。正式写入默认保持关闭，旧版继续负责正式业务。

> 不要将此源码包直接覆盖线上项目。尚未执行 Supabase 迁移，没有修改真实班级数据。
