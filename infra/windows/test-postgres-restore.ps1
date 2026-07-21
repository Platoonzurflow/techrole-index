[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$DumpPath,
    [string]$ManifestPath
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$workspacePrefix = $repoRoot.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar

function Assert-WorkspacePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [string]$Description
    )

    $resolved = (Resolve-Path -LiteralPath $Path).Path
    if (
        -not $resolved.Equals($repoRoot, [System.StringComparison]::OrdinalIgnoreCase) -and
        -not $resolved.StartsWith($workspacePrefix, [System.StringComparison]::OrdinalIgnoreCase)
    ) {
        throw "$Description must stay inside the TechRole Index workspace."
    }
    return $resolved
}

$resolvedDump = Assert-WorkspacePath -Path $DumpPath -Description 'Backup archive'
$dump = Get-Item -LiteralPath $resolvedDump
if ($dump.Length -le 0) {
    throw 'Backup archive is empty.'
}

$manifestWasExplicit = $PSBoundParameters.ContainsKey('ManifestPath')
if (-not $ManifestPath) {
    $ManifestPath = [System.IO.Path]::ChangeExtension($resolvedDump, '.json')
}
$manifestVerified = $false
$manifest = $null
if (Test-Path -LiteralPath $ManifestPath -PathType Leaf) {
    $resolvedManifest = Assert-WorkspacePath -Path $ManifestPath -Description 'Backup manifest'
    $manifest = Get-Content -Raw -LiteralPath $resolvedManifest -Encoding utf8 | ConvertFrom-Json
    if ($manifest.file -and $manifest.file -ne $dump.Name) {
        throw "Manifest names '$($manifest.file)', but the selected archive is '$($dump.Name)'."
    }
    if ($null -ne $manifest.bytes -and [long]$manifest.bytes -ne $dump.Length) {
        throw 'Backup archive size does not match the manifest.'
    }
    $actualHash = (Get-FileHash -LiteralPath $resolvedDump -Algorithm SHA256).Hash.ToLowerInvariant()
    if (-not $manifest.sha256 -or $manifest.sha256.ToString().ToLowerInvariant() -ne $actualHash) {
        throw 'Backup archive SHA-256 does not match the manifest.'
    }
    $manifestVerified = $true
}
elseif ($manifestWasExplicit) {
    throw "Backup manifest not found: $ManifestPath"
}

$token = [guid]::NewGuid().ToString('N').Substring(0, 10)
$restoreDatabase = "techrole_restore_$token"
$containerDumpPath = "/tmp/$restoreDatabase.dump"
$databaseUser = $null
$containerDumpCopied = $false
$restoreDatabaseCreated = $false
$operationError = $null
$cleanupErrors = [System.Collections.Generic.List[string]]::new()
$result = $null

Push-Location $repoRoot
try {
    try {
        $databaseUserOutput = docker compose exec -T postgres printenv POSTGRES_USER
        if ($LASTEXITCODE -ne 0) {
            throw 'Could not read POSTGRES_USER from the PostgreSQL container.'
        }
        $databaseUser = ($databaseUserOutput -join "`n").Trim()
        if ([string]::IsNullOrWhiteSpace($databaseUser)) {
            throw 'PostgreSQL container returned an empty database user.'
        }

        docker compose cp $resolvedDump "postgres:$containerDumpPath"
        if ($LASTEXITCODE -ne 0) {
            throw 'Could not copy the backup archive into the PostgreSQL container.'
        }
        $containerDumpCopied = $true

        docker compose exec -T postgres pg_restore --list $containerDumpPath | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw 'pg_restore could not read the backup archive.'
        }

        docker compose exec -T postgres createdb "--username=$databaseUser" $restoreDatabase
        if ($LASTEXITCODE -ne 0) {
            throw "Could not create isolated restore database $restoreDatabase."
        }
        $restoreDatabaseCreated = $true

        $restoreArguments = @(
            'compose', 'exec', '-T', 'postgres', 'pg_restore',
            "--username=$databaseUser",
            "--dbname=$restoreDatabase",
            '--no-owner',
            '--no-privileges',
            '--exit-on-error',
            $containerDumpPath
        )
        & docker @restoreArguments
        if ($LASTEXITCODE -ne 0) {
            throw 'Restoring the backup into the isolated database failed.'
        }

        $validationSql = @'
SELECT json_build_object(
    'migration_revision', (SELECT version_num FROM alembic_version LIMIT 1),
    'public_tables', (SELECT count(*)::bigint FROM pg_tables WHERE schemaname = 'public'),
    'professions', (SELECT count(*)::bigint FROM professions),
    'profession_metrics_daily', (SELECT count(*)::bigint FROM profession_metrics_daily),
    'observed_publication_metrics_daily', (SELECT count(*)::bigint FROM observed_publication_metrics_daily),
    'vacancies', (SELECT count(*)::bigint FROM vacancies),
    'users', (SELECT count(*)::bigint FROM users)
)::text;
'@
        $validationArguments = @(
            'compose', 'exec', '-T', 'postgres', 'psql',
            "--username=$databaseUser",
            "--dbname=$restoreDatabase",
            '--tuples-only',
            '--no-align',
            '--set=ON_ERROR_STOP=1',
            "--command=$validationSql"
        )
        $validationOutput = & docker @validationArguments
        if ($LASTEXITCODE -ne 0) {
            throw 'Restored database validation query failed.'
        }
        $validationJson = ($validationOutput -join "`n").Trim()
        $validation = $validationJson | ConvertFrom-Json
        if ([string]::IsNullOrWhiteSpace($validation.migration_revision)) {
            throw 'Restored database has no Alembic revision.'
        }
        if ([long]$validation.public_tables -lt 6) {
            throw 'Restored database is missing expected public tables.'
        }
        if ([long]$validation.professions -lt 1) {
            throw 'Restored database has no profession catalog.'
        }

        $result = [pscustomobject]@{
            restore_test = 'passed'
            archive = $resolvedDump
            manifest_verified = $manifestVerified
            source_database = if ($manifest) { $manifest.database } else { $null }
            migration_revision = $validation.migration_revision
            public_tables = [long]$validation.public_tables
            professions = [long]$validation.professions
            profession_metrics_daily = [long]$validation.profession_metrics_daily
            observed_publication_metrics_daily = [long]$validation.observed_publication_metrics_daily
            vacancies = [long]$validation.vacancies
            users = [long]$validation.users
        }
    }
    catch {
        $operationError = $_
    }
    finally {
        if ($restoreDatabaseCreated) {
            if (-not $restoreDatabase.StartsWith('techrole_restore_', [System.StringComparison]::Ordinal)) {
                $cleanupErrors.Add('Refused to drop a database without the restore-test prefix.')
            }
            else {
                $dropArguments = @(
                    'compose', 'exec', '-T', 'postgres', 'dropdb',
                    "--username=$databaseUser",
                    '--if-exists',
                    '--force',
                    $restoreDatabase
                )
                & docker @dropArguments | Out-Null
                if ($LASTEXITCODE -ne 0) {
                    $cleanupErrors.Add("Could not drop isolated restore database $restoreDatabase.")
                }
            }
        }
        if ($containerDumpCopied) {
            docker compose exec -T postgres rm -f -- $containerDumpPath | Out-Null
            if ($LASTEXITCODE -ne 0) {
                $cleanupErrors.Add("Could not remove temporary container archive $containerDumpPath.")
            }
        }
    }
}
finally {
    Pop-Location
}

if ($operationError) {
    throw $operationError
}
if ($cleanupErrors.Count -gt 0) {
    throw ($cleanupErrors -join ' ')
}

$result
