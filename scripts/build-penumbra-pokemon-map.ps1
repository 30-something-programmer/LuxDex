[CmdletBinding()]
param(
    [string]$DatabaseUrl = $env:DATABASE_URL,
    [string]$AliasPath,
    [string]$ReportPath
)

$ErrorActionPreference = 'Stop'
$RepositoryRoot = Split-Path -Parent $PSScriptRoot
$Python = Join-Path $RepositoryRoot '.venvs/app/Scripts/python.exe'
$ComposeFile = Join-Path $RepositoryRoot 'docker/compose.yml'

Push-Location $RepositoryRoot
try {
    if ($DatabaseUrl) {
        if (-not (Test-Path -LiteralPath $Python)) {
            throw 'LuxDex Python environment is missing. Run scripts/bootstrap.ps1 first.'
        }
        $Arguments = @('-m', 'app.identity.cli', '--database-url', $DatabaseUrl)
        if ($AliasPath) {
            $Arguments += @('--aliases', $AliasPath)
        }
        if ($ReportPath) {
            $Arguments += @('--report', $ReportPath)
        }
        & $Python @Arguments
    } else {
        if ($AliasPath -or $ReportPath) {
            throw '-AliasPath and -ReportPath require -DatabaseUrl because custom host paths are not copied into the app container.'
        }
        & docker compose --project-name luxdex --file $ComposeFile run --rm --build `
            --volume "${RepositoryRoot}:/workspace" `
            --workdir /workspace `
            app python -m app.identity.cli `
            --database-url postgresql://luxdex:luxdex-dev-only@db:5432/luxdex
    }
    if ($LASTEXITCODE -ne 0) {
        throw "Identity mapping build failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}
