[CmdletBinding()]
param(
    [string]$OutputDirectory,
    [ValidateRange(1, 3650)]
    [int]$RetentionDays = 14
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path $repoRoot 'backups'
}
$workspacePrefix = $repoRoot.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
$candidateOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
if (
    -not $candidateOutput.Equals($repoRoot, [System.StringComparison]::OrdinalIgnoreCase) -and
    -not $candidateOutput.StartsWith($workspacePrefix, [System.StringComparison]::OrdinalIgnoreCase)
) {
    throw 'Backup output must stay inside the TechRole Index workspace.'
}
New-Item -ItemType Directory -Force -Path $candidateOutput | Out-Null
$resolvedOutput = (Resolve-Path -LiteralPath $candidateOutput).Path

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$dumpPath = Join-Path $resolvedOutput "techrole-$stamp.dump"
$manifestPath = Join-Path $resolvedOutput "techrole-$stamp.json"
$containerPath = "/tmp/techrole-backup-$([guid]::NewGuid().ToString('N')).dump"
$databaseUser = $null
$databaseName = $null
$containerDumpCreated = $false

Push-Location $repoRoot
try {
    $databaseUserOutput = docker compose exec -T postgres printenv POSTGRES_USER
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not read POSTGRES_USER from the PostgreSQL container.'
    }
    $databaseUser = ($databaseUserOutput -join "`n").Trim()
    $databaseNameOutput = docker compose exec -T postgres printenv POSTGRES_DB
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not read POSTGRES_DB from the PostgreSQL container.'
    }
    $databaseName = ($databaseNameOutput -join "`n").Trim()
    if ([string]::IsNullOrWhiteSpace($databaseUser) -or [string]::IsNullOrWhiteSpace($databaseName)) {
        throw 'PostgreSQL container returned an empty database name or user.'
    }

    docker compose exec -T postgres pg_dump "--username=$databaseUser" "--dbname=$databaseName" -Fc -f $containerPath
    if ($LASTEXITCODE -ne 0) {
        throw 'pg_dump failed.'
    }
    $containerDumpCreated = $true
    docker compose cp "postgres:$containerPath" $dumpPath
    if ($LASTEXITCODE -ne 0) {
        throw 'docker compose cp failed.'
    }
    docker compose exec -T postgres pg_restore --list $containerPath | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw 'pg_restore could not read the backup archive.'
    }
}
finally {
    if ($containerDumpCreated) {
        docker compose exec -T postgres rm -f -- $containerPath | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Could not remove temporary container archive $containerPath."
        }
    }
    Pop-Location
}

$dump = Get-Item -LiteralPath $dumpPath
if ($dump.Length -le 0) {
    throw 'Backup file is empty.'
}
$hash = (Get-FileHash -LiteralPath $dumpPath -Algorithm SHA256).Hash.ToLowerInvariant()
[ordered]@{
    created_at = (Get-Date).ToString('o')
    file = $dump.Name
    bytes = $dump.Length
    sha256 = $hash
    format = 'PostgreSQL custom'
    database = $databaseName
    database_user = $databaseUser
    retention_days = $RetentionDays
} | ConvertTo-Json | Set-Content -LiteralPath $manifestPath -Encoding utf8

$cutoff = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -LiteralPath $resolvedOutput -File | Where-Object {
    $_.LastWriteTime -lt $cutoff -and $_.Name -match '^techrole-[0-9]{8}-[0-9]{6}[.](dump|json)$'
} | ForEach-Object {
    Remove-Item -LiteralPath $_.FullName -Force
}

[pscustomobject]@{
    file = $dumpPath
    manifest = $manifestPath
    bytes = $dump.Length
    sha256 = $hash
}
