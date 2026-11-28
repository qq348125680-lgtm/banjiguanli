# 智慧班级工作台 V7.0 Alpha 29 — 审核安全边界修正

## 本次实际修复
- 审核按钮现在仅对 `entry_type === '考勤'` 且 `status === '待审核'` 的事项显示；请假、违纪、成长积分等未迁移的业务明确提示回旧版处理。
- `canReviewSubmission` 对批准与驳回采用同样的“仅限考勤”约束，避免误调用 `v7_review_attendance`。
- 调整 Alpha12 旧测试中对“请假可以驳回”的过时预期，并增加 Alpha29 独立边界回归测试。

## 已验证（本机 Node 22）
- `npm test`：110/110 通过。
- `npm run verify:source`：现有 19 条源码契约断言通过。
- TypeScript 编译器的语法树解析检查：12 个 TS/TSX 文件通过（**不是完整类型检查**）。
- `npm run build`：**未通过**；缺少 `vite/client` 类型，未装完整项目依赖。
- 不包含线上 Supabase 修改，也没有启用 V7 数据写入。

## 有网络的开发环境执行
```sh
npm install
npm run verify:source
npm test
npm run build
npm run dev
```
注意：本包未生成 `package-lock.json`。真实生产构建通过后应提交锁文件并做双账号、手机/电脑浏览器验收。不得把 service_role 密钥放进前端。

## 已知上线阻塞
当前数据库仍需验证 `v7_cadre_roster` 与 `v7_review_attendance` 是否实际部署、函数权限以及审核与考勤是否原子入账。所有这些需在测试环境先验证；旧版继续运行。
