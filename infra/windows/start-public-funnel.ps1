[CmdletBinding()]
param(
    [string]$OriginUrl = 'http://127.0.0.1:3199',
    [ValidateRange(10, 300)]
    [int]$ApprovalWaitSeconds = 30,
    [ValidateRange(10, 180)]
    [int]$VerifyTimeoutSeconds = 60
)

$ErrorActionPreference = 'Stop'
$OriginUrl = $OriginUrl.TrimEnd('/')
$origin = [Uri]$OriginUrl
if ($origin.Scheme -ne 'http' -or $origin.Host -ne '127.0.0.1' -or $origin.Port -ne 3199) {
    throw 'OriginUrl must be exactly the loopback public proxy at http://127.0.0.1:3199.'
}

$tailscaleCommand = Get-Command tailscale.exe -ErrorAction SilentlyContinue
if ($tailscaleCommand) {
    $tailscalePath = $tailscaleCommand.Source
}
else {
    $tailscalePath = 'C:\Program Files\Tailscale\tailscale.exe'
    if (-not (Test-Path -LiteralPath $tailscalePath -PathType Leaf)) {
        throw 'Tailscale CLI is not installed.'
    }
}

$originHealth = Invoke-WebRequest -Uri "$OriginUrl/_proxy/health" -UseBasicParsing -TimeoutSec 10
if ($originHealth.StatusCode -ne 200) {
    throw "Public proxy preflight failed: status=$($originHealth.StatusCode)."
}

$toolRoot = Join-Path $env:LOCALAPPDATA 'TechRoleIndex'
$logRoot = Join-Path $toolRoot 'logs'
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
$stamp = Get-Date -Format 'yyyyMMddHHmmssfff'
$stdoutPath = Join-Path $logRoot "tailscale-funnel-$stamp.out.log"
$stderrPath = Join-Path $logRoot "tailscale-funnel-$stamp.err.log"
$funnelProcess = Start-Process -FilePath $tailscalePath `
    -ArgumentList @('funnel', '--bg', '--yes', $OriginUrl) `
    -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath `
    -WindowStyle Hidden -PassThru
$funnelExited = $funnelProcess.WaitForExit($ApprovalWaitSeconds * 1000)
if (-not $funnelExited) {
    Stop-Process -Id $funnelProcess.Id -Force
    $funnelProcess.WaitForExit()
}
$funnelOutput = (Get-Content -Raw -LiteralPath $stdoutPath -ErrorAction SilentlyContinue) +
    (Get-Content -Raw -LiteralPath $stderrPath -ErrorAction SilentlyContinue)
if (-not $funnelExited) {
    throw "Tailscale is still waiting for the one-time owner approval. Complete the official approval page and run this script again. $funnelOutput"
}
$funnelExitCode = $funnelProcess.ExitCode
$statusOutput = @(& $tailscalePath funnel status --json 2>&1)
$statusExitCode = $LASTEXITCODE
$statusText = ($statusOutput | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
if ($statusExitCode -ne 0) {
    if ($funnelExitCode -ne 0) {
        throw "Tailscale Funnel did not start. $funnelOutput $statusText"
    }
    throw "Tailscale Funnel started, but its JSON status could not be read. $statusText"
}

try {
    $funnelStatus = $statusText | ConvertFrom-Json
}
catch {
    throw "Tailscale Funnel returned invalid JSON status. $statusText"
}

$publicUrl = $null
foreach ($webProperty in $funnelStatus.Web.PSObject.Properties) {
    $rootHandler = $webProperty.Value.Handlers.PSObject.Properties['/']
    if (-not $rootHandler -or $rootHandler.Value.Proxy.TrimEnd('/') -ne $OriginUrl) {
        continue
    }
    $hostAndPort = $webProperty.Name
    $hostname = ($hostAndPort -split ':', 2)[0]
    $funnelProperty = $funnelStatus.AllowFunnel.PSObject.Properties[$hostAndPort]
    if ($funnelProperty -and $funnelProperty.Value -eq $true -and $hostname -match '^[a-z0-9.-]+[.]ts[.]net$') {
        $publicUrl = "https://$hostname"
        break
    }
}
if (-not $publicUrl) {
    throw "Tailscale Funnel status did not contain an enabled ts.net route to $OriginUrl. $statusText"
}

$verified = $false
$deadline = (Get-Date).AddSeconds($VerifyTimeoutSeconds)
do {
    try {
        $response = Invoke-WebRequest -Uri "$publicUrl/ai-index.json" -UseBasicParsing -TimeoutSec 15
        $payload = [Text.Encoding]::UTF8.GetString($response.RawContentStream.ToArray()) | ConvertFrom-Json
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
    throw "Funnel URL did not pass the 50-entity public check: $publicUrl"
}

$statusPath = Join-Path $toolRoot 'public-funnel-status.json'
$status = [ordered]@{
    url = $publicUrl
    origin = $OriginUrl
    provider = 'Tailscale Funnel (beta)'
    public = $true
    stable_hostname = $true
    host_dependent = $true
    production_ready = $false
    verified = $true
    configured_at = (Get-Date).ToString('o')
}
$status | ConvertTo-Json | Set-Content -LiteralPath $statusPath -Encoding utf8
[pscustomobject]$status
