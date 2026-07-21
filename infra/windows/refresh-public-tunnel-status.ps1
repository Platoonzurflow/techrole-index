[CmdletBinding()]
param(
    [ValidateRange(5, 60)]
    [int]$VerifyTimeoutSeconds = 20
)

$ErrorActionPreference = 'Stop'
$statusPath = Join-Path $env:LOCALAPPDATA 'TechRoleIndex\public-tunnel-status.json'
if (-not (Test-Path -LiteralPath $statusPath)) {
    throw 'Tunnel status file does not exist. Start the tunnel first.'
}

$status = Get-Content -Raw -LiteralPath $statusPath | ConvertFrom-Json
$process = Get-Process -Id $status.pid -ErrorAction SilentlyContinue
if (-not $process) {
    throw "Tunnel process $($status.pid) is not running."
}

$logText = (Get-Content -Raw -LiteralPath $status.stdout_log -ErrorAction SilentlyContinue) +
    (Get-Content -Raw -LiteralPath $status.stderr_log -ErrorAction SilentlyContinue)
$matches = [regex]::Matches($logText, 'https://[a-z0-9]+[.]lhr[.]life')
if ($matches.Count -eq 0) {
    throw 'No localhost.run URL was found in the tunnel logs.'
}
$latestUrl = $matches[$matches.Count - 1].Value

$verified = $false
$deadline = (Get-Date).AddSeconds($VerifyTimeoutSeconds)
do {
    try {
        $response = Invoke-WebRequest -Uri "$latestUrl/ai-index.json" -UseBasicParsing -TimeoutSec 10
        $payload = $response.Content | ConvertFrom-Json
        $verified = $response.StatusCode -eq 200 -and $payload.entities.Count -eq 50
    }
    catch {
        $verified = $false
    }
    if (-not $verified) {
        Start-Sleep -Seconds 2
    }
} while (-not $verified -and (Get-Date) -lt $deadline)
if (-not $verified) {
    throw "Latest tunnel URL did not pass verification: $latestUrl"
}

$previousUrls = @($status.previous_urls)
if ($status.url -and $status.url -ne $latestUrl) {
    $previousUrls += $status.url
}
$previousUrls = @($previousUrls | Where-Object { $_ -and $_ -ne $latestUrl } | Select-Object -Unique)
$rotated = $status.url -ne $latestUrl
$refreshed = [ordered]@{
    url = $latestUrl
    pid = [int]$status.pid
    started_at = $status.started_at
    origin = $status.origin
    provider = $status.provider
    temporary = $true
    verified = $true
    refreshed_at = (Get-Date).ToString('o')
    rotated_at = if ($rotated) { (Get-Date).ToString('o') } else { $status.rotated_at }
    previous_urls = $previousUrls
    stdout_log = $status.stdout_log
    stderr_log = $status.stderr_log
}
$refreshed | ConvertTo-Json | Set-Content -LiteralPath $statusPath -Encoding utf8
[pscustomobject]$refreshed
