@echo off
setlocal
cd /d "%~dp0.."
echo Uploading V7 source to the isolated GitHub TEST branch.
echo Local .env.local and your installed packages will NOT be uploaded.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0publish-test-branch.ps1"
echo.
if errorlevel 1 (
  echo Upload did NOT complete. Read the error message above.
) else (
  echo If upload succeeded, review GitHub Actions results.
)
pause
