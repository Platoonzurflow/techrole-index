[CmdletBinding()]
param(
    [ValidateRange(1, 30)]
    [int]$MaxAttempts = 12,
    [string]$OriginUrl = 'http://127.0.0.1:3199'
)

$ErrorActionPreference = 'Stop'
$toolRoot = Join-Path $env:LOCALAPPDATA 'TechRoleIndex'
$cloudflared = Join-Path $toolRoot 'bin\cloudflared.exe'
$logRoot = Join-Path $toolRoot 'logs'
$statusPath = Join-Path $toolRoot 'public-tunnel-status.json'

if (-not (Test-Path -LiteralPath $cloudflared)) {
    throw "cloudflared is missing: $cloudflared"
}
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null

for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    $stamp = Get-Date -Format 'yyyyMMddHHmmssfff'
    $stdoutPath = Join-Path $logRoot "cloudflared-$stamp-$attempt.out.log"
    $stderrPath = Join-Path $logRoot "cloudflared-$stamp-$attempt.err.log"
    $process = Start-Process -FilePath $cloudflared `
        -ArgumentList @('tunnel', '--protocol', 'http2', '--url', $OriginUrl, '--no-autoupdate') `
        -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath `
        -WindowStyle Hidden -PassThru

    $deadline = (Get-Date).AddSeconds(14)
    $publicUrl = $null
    do {
        Start-Sleep -Seconds 1
        $logText = (Get-Content -Raw -LiteralPath $stdoutPath -ErrorAction SilentlyContinue) +
            (Get-Content -Raw -LiteralPath $stderrPath -ErrorAction SilentlyContinue)
        foreach ($match in [regex]::Matches($logText, 'https://[a-z0-9-]+[.]trycloudflare[.]com')) {
            if ($match.Value -ne 'https://api.trycloudflare.com') {
                $publicUrl = $match.Value
            }
        }
    } while (-not $publicUrl -and -not $process.HasExited -and (Get-Date) -lt $deadline)

    if ($publicUrl -and -not $process.HasExited) {
        $status = [ordered]@{
            url = $publicUrl
            pid = $process.Id
            started_at = (Get-Date).ToString('o')
            origin = $OriginUrl
            provider = 'Cloudflare Quick Tunnel'
            temporary = $true
            running = $true
            stderr_log = $stderrPath
        }
        $status | ConvertTo-Json | Set-Content -LiteralPath $statusPath -Encoding utf8
        [pscustomobject]$status
        exit 0
    }

    if (-not $process.HasExited) {
        Stop-Process -Id $process.Id -Force
    }
    Start-Sleep -Seconds 2
}

throw "Cloudflare Quick Tunnel did not start after $MaxAttempts attempts. Check $logRoot"
