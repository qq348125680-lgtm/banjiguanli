# V7.0 Alpha 35 — Windows GitHub test-branch publishing fix

## What changed

The Alpha 34 uploader rejected any local `.env.local`, even though a correctly configured local React project needs that file. The replacement uploader **keeps local `.env.local` intact and excludes it from Git uploads**. It stages only allowlisted source folders and configuration files in a fresh temporary Git clone. It also excludes `node_modules`, compiled assets, private-key files, and common data exports, checks staged paths and scans the diff for privileged-key markers.

## How to upload from Windows

1. Unzip the complete package. Keep `.env.local` only in your local working copy if needed; **never upload it**. If using this newly extracted package, add only publishable settings locally for dev. Never use `service_role`/`sb_secret` in `VITE_` variables.
2. Have **Git for Windows** installed and authenticated to GitHub with permission to push to `qq348125680-lgtm/banjiguanli`.
3. Double-click `scripts/UPLOAD-TEST-BRANCH.cmd`, or open PowerShell in the project root and run `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\publish-test-branch.ps1`.
4. Inspect the GitHub Actions result: https://github.com/qq348125680-lgtm/banjiguanli/actions. A green result indicates that CI tests/build/smoke checks passed in GitHub, **not** that real Supabase accounts, permissions, or business writes passed acceptance.

## Safety and limits

- Only pushes to `test/v7-build-verification`, never `main`. Does not deploy a website or connect to database.
- The uploader will abort on detected secret patterns in staged content. Do not put passwords or personally identifying student information in source files.
- The script itself was authored/reviewed on Linux, where Windows PowerShell 5.1 is unavailable. **Actual Windows execution and GitHub Actions build still require verification.**
- CI uses placeholder VITE public variables, so successful CI does not verify actual production login.
- `VITE_ENABLE_WORKFLOW_WRITES=false` remains the build-test default.
