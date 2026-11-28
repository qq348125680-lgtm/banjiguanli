# Alpha 34 · GitHub 构建验证准备

## 已在 GitHub 完成

- 初始化 `qq348125680-lgtm/banjiguanli` 的空仓库：`main` 仅有说明文档。
- 创建 `test/v7-build-verification` 隔离测试分支。

## 未完成

- 由于本地 GitHub DNS 不通，尚未把完整 React 工程推送到测试分支。
- GitHub Actions 还没有运行，因此没有正式构建结果。

## Windows 一次上传测试分支

1. 安装 Git for Windows 并确保可以访问 GitHub；在 Git 中完成登录。
2. 解压此包，进入包含 `package.json` 的工程目录。
3. 打开 PowerShell 执行 `powershell -ExecutionPolicy Bypass -File .\scripts\publish-test-branch.ps1`。
4. 访问 GitHub Actions，查看工作流 `V7 React build and preview smoke (no deployment)` 的实际结果。
5. 如果通过，下载构建产物，再开展双账号与浏览器验收。

重要：测试分支不会部署网站，不会连接真实 Supabase 数据。不要上传真实学生名单、截图、数据库备份和任何 `.env.local` 或密钥。
