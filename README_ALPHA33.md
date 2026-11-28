# V7.0 Alpha 33 — 构建与 HTTP 冒烟验收

这一版本沿用 Alpha 32 的完整 React 工程，不修改 Supabase 数据库，也不执行生产部署。

## 新增
- `scripts/verify-dist.mjs`：校验 `dist/index.html`、引用的 JS/CSS、实际 JS 文件和明显的高权限密钥占位标识。
- `scripts/smoke-preview.mjs`：运行生产预览服务，HTTP 请求首页与打包 JS 文件并核对返回内容，结束时关闭预览进程。
- `.github/workflows/build-verification.yml`：GitHub Actions 中依次安装依赖、测试、构建、产物校验、HTTP 冒烟，并保留产物和 lockfile。**工作流不自动部署**。
- `.gitignore`：避免意外上传 `.env`、`node_modules`、构建产物。

## 实际运行状态
- 本地可执行 `npm test`、`npm run verify:source`、`npm run preflight:offline`。
- 本机 npm 官方仓库 DNS 报 `EAI_AGAIN`，无法下载 React/Vite，因而无法在本机执行生产构建、产物检查和 HTTP 冒烟。
- CI 工作流仅写在源码中，**尚未上传或在 GitHub 执行**。
- `npm install` 在 CI 成功后应把生成的 `package-lock.json` 审核并提交，后续将 CI 切换为 `npm ci` 以确保可复现构建。
- 产物校验只排查显眼的密钥/占位符，**不能替代安全扫描或真实授权验收**。

## 在 GitHub 运行
把压缩包工程**内部**文件放到仓库根目录，避免外面多一层文件夹；工作流在 Actions -> V7 React build and preview smoke -> Run workflow 手动执行。测试成功后在 Actions artifact 里查看 `dist` 和 `package-lock.json`。

警告：当前仓库若是公开仓库，绝对不要上传真实学生数据、`.env` 或 Supabase secret/service_role。正式写入开关为关闭。
