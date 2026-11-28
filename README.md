# 智慧班级工作台 V7.0 Alpha 32

**请先阅读 README_ALPHA32.md。** 本版本仍未通过生产构建与线上权限验收。

# 当前迭代：V7.0 Alpha 31

详见 `README_ALPHA31.md` 和 `ACCEPTANCE_ALPHA31.md`。

## 前一阶段 Alpha 30

请先阅读 [README_ALPHA30.md](README_ALPHA30.md)。本工程为待验收源码，不可直接覆盖正式线上系统。

# Alpha 29 更新

详见 `README_ALPHA29.md` 与 `ACCEPTANCE_ALPHA29.md`。

> 最新修复和验收边界请先阅读 [README_ALPHA26.md](README_ALPHA26.md)。

# Alpha 19 注意事项

参见 `README_ALPHA19.md`。当前仍为开发源码，默认关闭真实业务写入。

# 智慧班级工作台 V7.0 Alpha 18

本版本延续 Alpha 17 React + TypeScript 工程，**不是可直接替换线上系统的正式版**。

## 代码变动

- 新增 `src/lib/scope-loader.mjs`，并行加载学生名单、审核记录、待审核总数和操作日志，每项单独捕获错误。
- React `App.tsx` 只更新成功读取的数据；某一类查询失败不再清空其他类别的成功查询结果。
- 学生人数显示引入 `rosterLoaded`，无法读取名单时显示「—」，不再假装为零。
- 保留账号、班级切换的请求序号与清空旧数据逻辑，不能展示跨班陈旧记录。
- 增加6项独立加载测试，原有回归测试继续运行。

## 安全边界

- 未更改线上 Supabase 项目、SQL、GitHub 或学生数据。
- 默认关闭写入；只有在测试数据库部署、权限验证通过后才能考虑启用。
- `sql/alpha9_PROPOSED_NOT_APPLIED.sql` 是历史待审核迁移草案，**不得直接在生产库运行**。
- `public.v7_cadre_roster` 和 `public.v7_review_attendance` 在当前真实库中此前未检测到，未完成正式双账号验收。
- 已知部分旧版 SECURITY DEFINER 函数存在 Supabase 安全顾问警告，需单独评估，不能盲目批量撤销权限。

## 本地启动（有网络的电脑）

```bash
cp .env.example .env.local
npm install
npm test
npm run verify:source
npm run build
npm run dev
```

`.env.local` 仅使用公开 publishable/anon key，不得填写 service_role 或 secret key。正式部署需验证 RLS、接口可用性和手机/电脑端浏览器交互。
