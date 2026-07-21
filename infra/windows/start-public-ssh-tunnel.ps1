[CmdletBinding()]
param(
    [ValidateRange(1, 10)]
    [int]$MaxAttempts = 3,
    [string]$OriginUrl = 'http://127.0.0.1:3199'
)

$ErrorActionPreference = 'Stop'
$origin = [Uri]$OriginUrl
if ($origin.Scheme -ne 'http' -or $origin.Host -notin @('127.0.0.1', 'localhost')) {
    throw 'OriginUrl must be a loopback HTTP address.'
}

$ssh = (Get-Command ssh.exe -ErrorAction Stop).Source
$toolRoot = Join-Path $env:LOCALAPPDATA 'TechRoleIndex'
$logRoot = Join-Path $toolRoot 'logs'
$statusPath = Join-Path $toolRoot 'public-tunnel-status.json'
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null

for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    $stamp = Get-Date -Format 'yyyyMMddHHmmssfff'
    $stdoutPath = Join-Path $logRoot "localhost-run-$stamp-$attempt.out.log"
    $stderrPath = Join-Path $logRoot "localhost-run-$stamp-$attempt.err.log"
    $remoteForward = "80:$($origin.Host):$($origin.Port)"
    $arguments = @(
        '-T', '-n',
        '-o', 'BatchMode=yes',
        '-o', 'StrictHostKeyChecking=accept-new',
        '-o', 'ExitOnForwardFailure=yes',
        '-o', 'ServerAliveInterval=30',
        '-o', 'ServerAliveCountMax=3',
        '-R', $remoteForward,
        'nokey@localhost.run'
    )
    $process = Start-Process -FilePath $ssh -ArgumentList $arguments `
        -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath `
        -WindowStyle Hidden -PassThru

    $deadline = (Get-Date).AddSeconds(25)
    $publicUrl = $null
    do {
        Start-Sleep -Seconds 1
        $logText = (Get-Content -Raw -LiteralPath $stdoutPath -ErrorAction SilentlyContinue) +
            (Get-Content -Raw -LiteralPath $stderrPath -ErrorAction SilentlyContinue)
        $matches = [regex]::Matches($logText, 'https://[a-z0-9]+[.]lhr[.]life')
        if ($matches.Count -gt 0) {
            $publicUrl = $matches[$matches.Count - 1].Value
        }
    } while (-not $publicUrl -and -not $process.HasExited -and (Get-Date) -lt $deadline)

    $verified = $false
    if ($publicUrl -and -not $process.HasExited) {
        $verifyDeadline = (Get-Date).AddSeconds(20)
        do {
            try {
                $response = Invoke-WebRequest -Uri "$publicUrl/ai-index.json" -UseBasicParsing -TimeoutSec 10
                $payload = $response.Content | ConvertFrom-Json
                $verified = $response.StatusCode -eq 200 -and $payload.entities.Count -eq 50
            }
            catch {
                $verified = $false
            }
            if (-not $verified) {
                Start-Sleep -Seconds 2
            }
        } while (-not $verified -and -not $process.HasExited -and (Get-Date) -lt $verifyDeadline)
    }

    if ($verified -and -not $process.HasExited) {
        $status = [ordered]@{
            url = $publicUrl
            pid = $process.Id
            started_at = (Get-Date).ToString('o')
            origin = $OriginUrl
            provider = 'localhost.run SSH tunnel'
            temporary = $true
            verified = $true
            stdout_log = $stdoutPath
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

throw "localhost.run tunnel did not start after $MaxAttempts attempts. Check $logRoot"
