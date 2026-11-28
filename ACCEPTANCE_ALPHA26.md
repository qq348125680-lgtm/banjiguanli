# Alpha 26 验收记录

| 范围 | 结果 | 证据/限制 |
| --- | --- | --- |
| 首次渲染 TDZ 错误 | 源码已修复 | 依赖数组中的 `isAuthorizedClass` 在声明后使用 |
| 新增 AST 规则 | 3/3 通过 | `alpha26-render-order.test.mjs` |
| 累计 Node 测试 | 95/95 通过 | `node --test tests/*.test.mjs` |
| 既有源码约束 | 19/19 通过 | `node tests/source-contract.mjs` |
| 本地导入路径 | 31 条通过 | `node scripts/offline-preflight.mjs` |
| 完整 TypeScript 检查和生产构建 | 未验收 | npm registry DNS 解析失败；缺少本地 React/Vite 等依赖 |
| React 首屏真实浏览器运行 | 未验收 | 缺少可运行的生产/开发依赖 |
| Supabase 双账号/RLS 和事务 | 未验收 | 本次不对线上库写入或变更结构 |
| 手机/电脑回归 | 未验收 | 需要实际浏览器和完整运行环境 |

本次未修改线上 GitHub/Supabase。此版本不适合直接部署替换正式版。
