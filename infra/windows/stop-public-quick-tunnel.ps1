[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$toolRoot = Join-Path $env:LOCALAPPDATA 'TechRoleIndex'
$statusPath = Join-Path $toolRoot 'public-tunnel-status.json'
$expectedExecutable = Join-Path $toolRoot 'bin\cloudflared.exe'

if (-not (Test-Path -LiteralPath $statusPath -PathType Leaf)) {
    [pscustomobject]@{
        stopped = $false
        reason = 'status_missing'
        status_path = $statusPath
    }
    exit 0
}

$status = Get-Content -Raw -LiteralPath $statusPath | ConvertFrom-Json
if (-not $status.pid) {
    throw "Quick Tunnel status does not contain a process ID: $statusPath"
}

$processId = [int]$status.pid
$process = Get-Process -Id $processId -ErrorAction SilentlyContinue
if ($process) {
    $actualExecutable = $process.Path
    if (-not $actualExecutable) {
        throw "Cannot verify executable path for process $processId; it was not stopped."
    }
    $expectedResolved = [IO.Path]::GetFullPath($expectedExecutable)
    $actualResolved = [IO.Path]::GetFullPath($actualExecutable)
    if (-not $actualResolved.Equals($expectedResolved, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Process $processId is not the recorded TechRole Index cloudflared process; it was not stopped."
    }
    Stop-Process -Id $processId -Force
    $process.WaitForExit()
}

$updatedStatus = [ordered]@{}
foreach ($property in $status.PSObject.Properties) {
    $updatedStatus[$property.Name] = $property.Value
}
$updatedStatus.running = $false
$updatedStatus.stopped_at = (Get-Date).ToString('o')
$updatedStatus | ConvertTo-Json | Set-Content -LiteralPath $statusPath -Encoding utf8

[pscustomobject]@{
    stopped = [bool]$process
    process_id = $processId
    url = $status.url
    canonical_funnel_unchanged = $true
}
