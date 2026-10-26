#requires -Version 7.0
<#
  Agent 在每轮项目修改或对话完成后调用；不是聊天监听器，也不注册后台任务。
  -SkipPush 仍然生成日志、验证、暂存并提交，只跳过网络推送。
  检查失败时保留工作区、暂存区和已经生成的本地提交，不做自动回退。
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [ValidateLength(1, 240)]
    [string]$Summary,

    [ValidateSet('feature', 'ui', 'bug', 'discussion', 'test', 'maintenance')]
    [string]$Kind = 'maintenance',

    [ValidateLength(0, 6000)]
    [string]$Details = '',

    [switch]$SkipPush
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd([IO.Path]::DirectorySeparatorChar)
$expectedRemote = 'https://github.com/ZGL686/Wen-xin-web.git'
$script:gitPath = $null
$runLock = $null
$logRelativePath = $null
$exitCode = 0

function Find-Executable {
    param([string[]]$Names, [string]$Fallback = '')
    foreach ($name in $Names) {
        $command = Get-Command $name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($null -ne $command) { return $command.Source }
    }
    if ($Fallback -and (Test-Path -LiteralPath $Fallback -PathType Leaf)) { return $Fallback }
    throw "找不到可运行程序：$($Names -join ' / ')。安装后重试；没有修改或删除本地工作。"
}

function Invoke-Program {
    param(
        [Parameter(Mandatory)][string]$FilePath,
        [string[]]$Arguments = @(),
        [string]$InputText = '',
        [switch]$AllowFailure,
        [switch]$ShowOutput
    )
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $FilePath
    $start.WorkingDirectory = $projectRoot
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardInput = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.StandardOutputEncoding = [Text.UTF8Encoding]::new($false)
    $start.StandardErrorEncoding = [Text.UTF8Encoding]::new($false)
    $start.Environment['GIT_TERMINAL_PROMPT'] = '0'
    $start.Environment['GCM_INTERACTIVE'] = 'Never'
    $start.Environment['PYTHONUTF8'] = '1'
    foreach ($argument in $Arguments) { $start.ArgumentList.Add($argument) }
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $start
    try {
        if (-not $process.Start()) { throw "无法启动 $FilePath" }
        $stdoutTask = $process.StandardOutput.ReadToEndAsync()
        $stderrTask = $process.StandardError.ReadToEndAsync()
        if ($InputText) { $process.StandardInput.Write($InputText) }
        $process.StandardInput.Close()
        $process.WaitForExit()
        $stdout = $stdoutTask.GetAwaiter().GetResult()
        $stderr = $stderrTask.GetAwaiter().GetResult()
        $result = [pscustomobject]@{ ExitCode = $process.ExitCode; StdOut = $stdout; StdErr = $stderr }
    }
    finally { $process.Dispose() }
    if ($ShowOutput) {
        if ($result.StdOut.Trim()) { Write-Host $result.StdOut.TrimEnd() }
        if ($result.StdErr.Trim()) { Write-Host $result.StdErr.TrimEnd() }
    }
    if ($result.ExitCode -ne 0 -and -not $AllowFailure) {
        $diagnostic = ($result.StdErr + "`n" + $result.StdOut).Trim()
        if ($diagnostic.Length -gt 6000) { $diagnostic = $diagnostic.Substring(0, 6000) }
        throw "程序执行失败（退出码 $($result.ExitCode)）：$([IO.Path]::GetFileName($FilePath)) $($Arguments -join ' ')`n$diagnostic"
    }
    return $result
}

function Invoke-Git {
    param([string[]]$Arguments, [string]$InputText = '', [switch]$AllowFailure, [switch]$ShowOutput)
    Invoke-Program -FilePath $script:gitPath -Arguments (@('-C', $projectRoot, '-c', 'core.quotepath=false') + $Arguments) -InputText $InputText -AllowFailure:$AllowFailure -ShowOutput:$ShowOutput
}

function Find-Python {
    $candidates = [Collections.Generic.List[string]]::new()
    foreach ($name in @('python3', 'python')) {
        $command = Get-Command $name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($null -ne $command -and -not $candidates.Contains($command.Source)) { $candidates.Add($command.Source) }
    }
    $fallback = 'C:\Users\SM\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
    if ((Test-Path -LiteralPath $fallback -PathType Leaf) -and -not $candidates.Contains($fallback)) { $candidates.Add($fallback) }
    foreach ($candidate in $candidates) {
        try {
            $probe = Invoke-Program -FilePath $candidate -Arguments @('-c', 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)') -AllowFailure
            if ($probe.ExitCode -eq 0) { return $candidate }
        }
        catch { continue }
    }
    throw '找不到可用的 Python 3.10+。已检查 python3、python 和 Windows Codex runtime；无效的商店别名不会阻止继续查找。'
}

function Assert-Repository {
    $actualRoot = (Invoke-Git -Arguments @('rev-parse', '--show-toplevel')).StdOut.Trim()
    $actualRoot = [IO.Path]::GetFullPath($actualRoot).TrimEnd([IO.Path]::DirectorySeparatorChar)
    if (-not [string]::Equals($actualRoot, $projectRoot, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Git 根目录不匹配，拒绝同步。预期：$projectRoot；实际：$actualRoot"
    }
    $branch = (Invoke-Git -Arguments @('branch', '--show-current')).StdOut.Trim()
    if ($branch -cne 'main') { throw "当前分支是 '$branch'，只允许在 main 同步。脚本不会自动切换分支。" }
    $remotes = @((Invoke-Git -Arguments @('remote', 'get-url', '--all', 'origin')).StdOut.Trim() -split '\r?\n' | Where-Object { $_ })
    $pushRemotes = @((Invoke-Git -Arguments @('remote', 'get-url', '--push', '--all', 'origin')).StdOut.Trim() -split '\r?\n' | Where-Object { $_ })
    foreach ($remote in @($remotes) + @($pushRemotes)) {
        if ($remote -notmatch '^https://github\.com/ZGL686/Wen-xin-web(?:\.git)?/?$') {
            throw "origin 的读取或推送地址与预期仓库不符。只允许：$expectedRemote"
        }
    }
    if ($remotes.Count -ne 1 -or $pushRemotes.Count -ne 1) { throw 'origin 必须且只能有一个读取地址和一个推送地址。' }
    $unmerged = (Invoke-Git -Arguments @('diff', '--name-only', '--diff-filter=U')).StdOut
    if ($unmerged.Trim()) { throw '存在未解决的合并冲突。请先处理冲突；脚本不会 reset、清理或自动 rebase。' }
}

function Assert-StagedFiles {
    $stagedText = (Invoke-Git -Arguments @('diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z')).StdOut
    $stagedPaths = @($stagedText -split "`0" | Where-Object { $_.Length -gt 0 })
    $indexText = (Invoke-Git -Arguments @('ls-files', '--stage', '-z')).StdOut
    $indexByPath = [Collections.Generic.Dictionary[string, object]]::new([StringComparer]::Ordinal)
    foreach ($entry in ($indexText -split "`0")) {
        if (-not $entry) { continue }
        if ($entry -notmatch '(?s)^([0-9]{6}) ([0-9a-f]+) ([0-3])\t(.*)$') { throw '无法可靠解析 Git 索引，已停止提交。' }
        $indexByPath[$Matches[4]] = [pscustomobject]@{ Mode = $Matches[1]; Hash = $Matches[2]; Stage = $Matches[3] }
    }
    $blobPaths = [Collections.Generic.Dictionary[string, string]]::new([StringComparer]::Ordinal)
    foreach ($stagedPath in $stagedPaths) {
        $normalized = $stagedPath.Replace('\', '/')
        $baseName = ($normalized -split '/')[-1]
        if ($normalized -match '(^|/)(\.git|\.sites-runtime|\.wrangler|node_modules|\.next|\.vinext|\.cache|__pycache__|\.venv|runtime|keys)(/|$)') {
            throw "暂存区含运行环境、嵌套 Git 或密钥目录：$stagedPath。请修正 .gitignore 并显式取消该文件的暂存后重试。"
        }
        if ($baseName -match '^\.(env|dev\.vars)(?:\..*)?$' -and $baseName -notmatch '\.example$') {
            throw "暂存区含环境机密文件：$stagedPath。只允许不含真实密钥的 .example 示例文件。"
        }
        if ($baseName -match '(?i)(\.(pem|key|p12|pfx|keystore|jks)$|^id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$|^(credentials|tokens?)([-_.].*)?\.json$|^service[-_]?account.*\.json$|^secrets?\.(json|ya?ml)$)') {
            throw "暂存区含疑似密钥或凭据文件：$stagedPath。已停止提交，所有本地文件保持原样。"
        }
        if (-not $indexByPath.ContainsKey($stagedPath)) { throw "暂存索引缺少文件：$stagedPath" }
        $entry = $indexByPath[$stagedPath]
        if ($entry.Stage -ne '0') { throw "暂存区仍有冲突：$stagedPath" }
        if ($entry.Mode -eq '160000') { throw "暂存区含嵌套仓库或子模块：$stagedPath。请先明确处理，脚本不会隐式打包另一个仓库。" }
        $blobPaths[$entry.Hash] = $stagedPath
    }
    if ($blobPaths.Count -gt 0) {
        $objectInput = ($blobPaths.Keys -join "`n") + "`n"
        $sizes = (Invoke-Git -Arguments @('cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)') -InputText $objectInput).StdOut
        foreach ($line in ($sizes.TrimEnd() -split '\r?\n')) {
            if ($line -notmatch '^([0-9a-f]+) blob ([0-9]+)$') { throw '无法确认暂存文件的 Git blob 类型或大小，已停止提交。' }
            if ([long]$Matches[2] -gt 100MB) {
                throw "普通 Git blob 超过 100 MiB：$($blobPaths[$Matches[1]])。请先使用 Git LFS 正确跟踪并重新暂存，再运行同步。脚本不会自动改写历史。"
            }
        }
    }
}

try {
    $Summary = ($Summary -replace '\s+', ' ').Trim()
    $Kind = $Kind.ToLowerInvariant()
    if (-not $Summary) { throw 'Summary 不能只包含空白。请写一句本轮工作摘要。' }
    if (($Summary + "`n" + $Details) -match '(?i)(-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{24,})') {
        throw '摘要或 Details 疑似包含访问令牌或私钥。请仅保留工作结论，不要保存密钥或完整对话。'
    }
    $script:gitPath = Find-Executable -Names @('git')
    Assert-Repository
    $gitDirectory = (Invoke-Git -Arguments @('rev-parse', '--absolute-git-dir')).StdOut.Trim()
    try { $runLock = [IO.File]::Open((Join-Path $gitDirectory 'project-sync.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
    catch { throw '另一个 project-sync 进程正在运行，或无法锁定 Git 目录。请等待它结束后重试。' }

    $pythonPath = Find-Python
    $nodePath = Find-Executable -Names @('node')
    $wikiRoot = Join-Path $projectRoot 'wiki_memory'
    $lintPath = Join-Path $wikiRoot '工具\memory_lint.py'
    $verifyPath = Join-Path $projectRoot 'tools\verify-project.mjs'
    if (-not (Test-Path -LiteralPath $lintPath -PathType Leaf)) { throw '缺少 wiki_memory/工具/memory_lint.py。请先整理为单层 wiki_memory，脚本不会猜测或搬移目录。' }
    if (-not (Test-Path -LiteralPath $verifyPath -PathType Leaf)) { throw '缺少 tools/verify-project.mjs，无法完成项目门禁。' }

    try { $beijingZone = [TimeZoneInfo]::FindSystemTimeZoneById('Asia/Shanghai') }
    catch { $beijingZone = [TimeZoneInfo]::FindSystemTimeZoneById('China Standard Time') }
    $now = [TimeZoneInfo]::ConvertTimeFromUtc([DateTime]::UtcNow, $beijingZone)
    $date = $now.ToString('yyyy-MM-dd')
    $unique = [Guid]::NewGuid().ToString('N').Substring(0, 8)
    $logName = '{0}-{1}-{2}.md' -f $now.ToString('yyyy-MM-dd-HHmmss-fff'), $Kind, $unique
    $topic = 'session-{0}-{1}' -f $now.ToString('yyyyMMdd-HHmmss-fff'), $unique
    $logDirectory = Join-Path $wikiRoot '日志'
    [IO.Directory]::CreateDirectory($logDirectory) | Out-Null
    $logPath = Join-Path $logDirectory $logName
    $logRelativePath = 'wiki_memory/日志/' + $logName
    $detailSection = if ($Details.Trim()) { $Details.Trim() } else { '- 未补充细节；本日志只保存本轮摘要。' }
    $logText = @"
---
type: log
status: archived
kind: $Kind
importance: medium
updated: $date
topic: $topic
source_logs: []
supersedes: null
---

# $date｜$Summary

- 时间：$($now.ToString('yyyy-MM-dd HH:mm:ss'))（北京时间，UTC+08:00）
- 类型：$Kind
- 目标：$Summary
- 日志索引：[[日志/MOC_工作日志|工作日志 MOC]]

## 目标

- $Summary

## 变更与验证

$detailSection

- 自动门禁：保存日志后依次运行记忆索引、记忆体检及项目资料验证；任一失败立即停止。
- Git 同步：门禁通过后才暂存、提交、检查远端并普通推送；实际结果以脚本最终输出为准。

## 结果

- 已将本轮摘要追加为独立历史日志，不包含完整聊天。
- 本轮提交模式：$(if ($SkipPush) { '仅本地提交（SkipPush）' } else { '验证后提交并尝试推送 origin/main' })。
- 遇到检查、Git 或 LFS 失败时，保留日志、工作区、暂存区及已创建的本地提交，等待人工处理。

## 待确认长期记忆

- 默认无；已确认要求及源码/测试事实按用户持续授权由 Agent 更新，未经确认的新推测保持 proposed。本脚本不替 Agent 修改 active 页面。
"@
    $stream = [IO.File]::Open($logPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
    try {
        $bytes = [Text.UTF8Encoding]::new($false).GetBytes($logText + "`n")
        $stream.Write($bytes, 0, $bytes.Length)
    }
    finally { $stream.Dispose() }
    Write-Host "已追加日志：$logRelativePath"

    Invoke-Program -FilePath $pythonPath -Arguments @($lintPath, '--root', $wikiRoot, 'index') -ShowOutput | Out-Null
    Invoke-Program -FilePath $pythonPath -Arguments @($lintPath, '--root', $wikiRoot, 'check') -ShowOutput | Out-Null
    Invoke-Program -FilePath $nodePath -Arguments @($verifyPath) -ShowOutput | Out-Null
    Assert-Repository
    Invoke-Git -Arguments @('add', '-A') | Out-Null
    Assert-StagedFiles
    Invoke-Git -Arguments @('commit', '-m', "[$Kind] $Summary") -ShowOutput | Out-Null
    $commit = (Invoke-Git -Arguments @('rev-parse', 'HEAD')).StdOut.Trim()

    $attributesPath = Join-Path $projectRoot '.gitattributes'
    if ((Test-Path -LiteralPath $attributesPath) -and ([IO.File]::ReadAllText($attributesPath) -match 'filter=lfs')) {
        Invoke-Git -Arguments @('lfs', 'version') | Out-Null
        Invoke-Git -Arguments @('lfs', 'fsck', '--objects') -ShowOutput | Out-Null
    }
    if ($SkipPush) {
        Write-Host "同步完成（仅本地）：$commit。已按 SkipPush 跳过远端检查和推送。"
    }
    else {
        Assert-Repository
        # 只读取远端 main；不 merge、pull、rebase，也不改写工作区。
        $remoteMain = (Invoke-Git -Arguments @('-c', 'http.lowSpeedLimit=1024', '-c', 'http.lowSpeedTime=60', 'ls-remote', '--heads', 'origin', 'refs/heads/main')).StdOut.Trim()
        if ($remoteMain) {
            Invoke-Git -Arguments @('-c', 'http.lowSpeedLimit=1024', '-c', 'http.lowSpeedTime=60', 'fetch', '--no-tags', 'origin', 'refs/heads/main') -ShowOutput | Out-Null
            $counts = (Invoke-Git -Arguments @('rev-list', '--left-right', '--count', 'HEAD...FETCH_HEAD')).StdOut.Trim() -split '\s+'
            if ($counts.Count -ne 2) { throw '无法可靠读取本地与远端的提交差异。' }
            if ([long]$counts[1] -gt 0) {
                throw "远端 main 有 $($counts[1]) 个本地尚未包含的提交，已拒绝推送。请先审查并手动整合远端；本地提交 $commit 保留。"
            }
        }
        Invoke-Git -Arguments @('-c', 'http.lowSpeedLimit=1024', '-c', 'http.lowSpeedTime=60', 'push', 'origin', 'main') -ShowOutput | Out-Null
        Write-Host "同步完成：$commit 已普通推送至 origin/main。"
    }
}
catch {
    $exitCode = 1
    Write-Error -Message ("项目同步失败：" + $_.Exception.Message) -ErrorAction Continue
    if ($logRelativePath) { Write-Host "已生成的日志保留在：$logRelativePath" }
    Write-Host '未执行 force、reset、clean、自动 rebase 或回滚；请处理问题后再次运行。'
}
finally {
    if ($null -ne $runLock) { $runLock.Dispose() }
}
exit $exitCode
