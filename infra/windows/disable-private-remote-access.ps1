#Requires -RunAsAdministrator

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$ruleGroup = 'TechRole Index - Private RDP via Tailscale'
Get-NetFirewallRule -Group $ruleGroup -ErrorAction SilentlyContinue | Remove-NetFirewallRule
Set-ItemProperty -LiteralPath 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server' `
    -Name 'fDenyTSConnections' -Type DWord -Value 1

[pscustomobject]@{
    RemoteDesktopEnabled = $false
    PrivateFirewallRulesRemoved = $true
}
