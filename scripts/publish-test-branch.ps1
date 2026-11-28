# V7 test branch upload. Windows PowerShell 5.1 compatible, ASCII-only source.
# Never reads, copies, stages, or uploads local .env files or credentials.
$ErrorActionPreference = 'Stop'
$repo = 'https://github.com/qq348125680-lgtm/banjiguanli.git'
$branch = 'test/v7-build-verification'
$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $root 'package.json'))) { throw 'Run this script from the complete V7 project.' }
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git for Windows is required: https://git-scm.com/downloads/win' }

# Strictly allow project source and config; deliberately omit ALL local environment files.
$allowedDirectories = @('.github', 'src', 'scripts', 'tests', 'sql')
$allowedRootFiles = @('index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', 'vite.config.ts', '.gitignore', '.env.example')
$staging = Join-Path ([System.IO.Path]::GetTempPath()) ('v7-source-upload-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $staging | Out-Null
function Assert-ExitCode([string]$label) {
    if ($LASTEXITCODE -ne 0) { throw "$label failed with exit code $LASTEXITCODE" }
}
function Is-SafeProjectPath([string]$relativePath) {
    $p = $relativePath.Replace('\', '/')
    if ($p -ne '.env.example' -and $p -match '(^|/)(\.env(\..*)?|node_modules|dist|\.git|\.DS_Store|\.npmrc)(/|$)') { return $false }
    if ($p -match '(?i)\.(pem|p12|pfx|key|sqlite|db|zip|7z|rar|xlsx|xls|pdf|docx|png|jpg|jpeg)$') { return $false }
    if ($p -match '(?i)(secret|credential|password|backup|student.?roster)') { return $false }
    if ($p -notmatch '^[a-zA-Z0-9_./-]+$') { return $false }
    return $true
}
try {
    Write-Host 'Cloning TEST branch (no changes to main)...'
    & git clone --depth 1 --branch $branch $repo $staging
    Assert-ExitCode 'Git clone'

    # Remove old tracked files in the isolated staging clone, preserving .git.
    Get-ChildItem -LiteralPath $staging -Force | Where-Object { $_.Name -ne '.git' } | ForEach-Object {
        Remove-Item -LiteralPath $_.FullName -Recurse -Force
    }

    foreach ($file in $allowedRootFiles) {
        $source = Join-Path $root $file
        if (Test-Path -LiteralPath $source -PathType Leaf) {
            Copy-Item -LiteralPath $source -Destination (Join-Path $staging $file) -Force
        }
    }
    foreach ($dir in $allowedDirectories) {
        $sourceDir = Join-Path $root $dir
        if (-not (Test-Path -LiteralPath $sourceDir -PathType Container)) { continue }
        $all = Get-ChildItem -LiteralPath $sourceDir -Recurse -File -Force
        foreach ($sourceFile in $all) {
            $relative = $sourceFile.FullName.Substring($root.Length).TrimStart('\', '/')
            if (-not (Is-SafeProjectPath $relative)) { continue }
            $target = Join-Path $staging $relative
            $parent = Split-Path -Parent $target
            if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
            Copy-Item -LiteralPath $sourceFile.FullName -Destination $target -Force
        }
    }
    # Include existing README/ACCEPTANCE markdown, which is source documentation only.
    Get-ChildItem -LiteralPath $root -File -Filter '*.md' | ForEach-Object {
        if (Is-SafeProjectPath $_.Name) { Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $staging $_.Name) }
    }

    Push-Location $staging
    try {
        & git add -A
        Assert-ExitCode 'Stage'
        $staged = @(& git diff --cached --name-only)
        Assert-ExitCode 'List staged files'
        foreach ($path in $staged) {
            if (-not (Is-SafeProjectPath $path)) { throw "Unsafe staged file: $path" }
        }
        & git diff --cached --check
        Assert-ExitCode 'Staged diff check'
        if ($staged.Count -eq 0) { Write-Host 'Test branch is already up-to-date.'; return }
        Write-Host ('Staged ' + $staged.Count + ' safe source file changes; checking for secrets...')
        # Scan staged text diff for private tokens. A detected token stops upload.
        $diff = (& git diff --cached --no-ext-diff --unified=0 -- . ':!package-lock.json') -join "`n"
        if ($diff -match '(?i)(sb_secret_[A-Za-z0-9_-]{12,}|service_role\s*[=:]\s*[A-Za-z0-9._-]{12,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----)') {
            throw 'Potential privileged credential found in staged diff; upload aborted.'
        }
        & git commit -m 'test: verify V7 React build without local secrets'
        Assert-ExitCode 'Git commit (ensure git user.name and user.email are configured)'
        & git push origin $branch
        Assert-ExitCode 'Git push'
        Write-Host 'SUCCESS: V7 source uploaded to TEST branch only.' -ForegroundColor Green
        Write-Host 'https://github.com/qq348125680-lgtm/banjiguanli/actions'
        Write-Host 'Local .env.local and node_modules were NOT copied or changed.'
    } finally { Pop-Location }
} finally {
    if (Test-Path $staging) { Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue }
}
