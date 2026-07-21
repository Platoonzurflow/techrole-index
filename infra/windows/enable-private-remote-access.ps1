#Requires -RunAsAdministrator

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$ruleGroup = 'TechRole Index - Private RDP via Tailscale'
$tailscaleService = Get-Service -Name 'Tailscale' -ErrorAction SilentlyContinue
if ($null -eq $tailscaleService) {
    throw 'Tailscale is not installed. Install it and sign in before enabling Remote Desktop.'
}

if ($tailscaleService.Status -ne 'Running') {
    Start-Service -Name 'Tailscale'
}

$tailscaleAdapter = Get-NetAdapter | Where-Object {
    $_.InterfaceDescription -like '*Tailscale*' -or $_.Name -like '*Tailscale*'
} | Select-Object -First 1
if ($null -eq $tailscaleAdapter) {
    throw 'The Tailscale network adapter is not ready. Open Tailscale and sign in first.'
}

# Keep Network Level Authentication enabled and enable the RDP host itself.
Set-ItemProperty -LiteralPath 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server' `
    -Name 'fDenyTSConnections' -Type DWord -Value 0
Set-ItemProperty -LiteralPath 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp' `
    -Name 'UserAuthentication' -Type DWord -Value 1

# Notify the Remote Desktop configuration provider as well as updating the
# registry. Unlike restarting TermService, this does not interrupt an active
# local session and works on machines where Windows refuses to stop the service.
$terminalSettings = Get-CimInstance -Namespace 'root/cimv2/TerminalServices' `
    -ClassName 'Win32_TerminalServiceSetting'
$enableResult = Invoke-CimMethod -InputObject $terminalSettings `
    -MethodName 'SetAllowTSConnections' `
    -Arguments @{ AllowTSConnections = 1; ModifyFirewallException = 0 }
if ($enableResult.ReturnValue -ne 0) {
    throw "Windows could not enable Remote Desktop (WMI code $($enableResult.ReturnValue))."
}

# Never enable the built-in broad Remote Desktop group. These rules accept traffic
# only from the private Tailscale range and only on the Tailscale adapter.
Get-NetFirewallRule -Group $ruleGroup -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName 'TechRole Private RDP (TCP)' -Group $ruleGroup `
    -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3389 -Profile Any `
    -InterfaceAlias $tailscaleAdapter.Name -RemoteAddress '100.64.0.0/10' | Out-Null
New-NetFirewallRule -DisplayName 'TechRole Private RDP (UDP)' -Group $ruleGroup `
    -Direction Inbound -Action Allow -Protocol UDP -LocalPort 3389 -Profile Any `
    -InterfaceAlias $tailscaleAdapter.Name -RemoteAddress '100.64.0.0/10' | Out-Null

Set-Service -Name 'TermService' -StartupType Automatic
if ((Get-Service -Name 'TermService').Status -ne 'Running') {
    Start-Service -Name 'TermService'
}

$listenerReady = $false
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    $listenerReady = [bool](Get-NetTCPConnection -LocalPort 3389 -State Listen `
        -ErrorAction SilentlyContinue)
    if ($listenerReady) { break }
    Start-Sleep -Milliseconds 500
}
$restartRequired = -not $listenerReady
if ($restartRequired) {
    Write-Warning 'Remote Desktop is configured, but Windows must be restarted once to create the RDP listener.'
}

$tailscaleIp = Get-NetIPAddress -InterfaceAlias $tailscaleAdapter.Name -AddressFamily IPv4 `
    -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -like '100.*' } | `
    Select-Object -ExpandProperty IPAddress -First 1

[pscustomobject]@{
    RemoteDesktopEnabled = $true
    NetworkLevelAuthentication = $true
    TailscaleInterface = $tailscaleAdapter.Name
    TailscaleAddress = $tailscaleIp
    PublicRdpRuleEnabled = $false
    ListenerReady = $listenerReady
    RestartRequired = $restartRequired
}
