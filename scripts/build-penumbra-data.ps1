[CmdletBinding()]
param(
    [string]$DatabaseUrl,
    [string]$Source
)

$ErrorActionPreference = 'Stop'
$RepositoryRoot = Split-Path -Parent $PSScriptRoot
$PythonPath = Join-Path $RepositoryRoot '.venvs\app\Scripts\python.exe'
$ComposeFile = Join-Path $RepositoryRoot 'docker\compose.yml'

Push-Location $RepositoryRoot
try {
    if ($DatabaseUrl) {
        if (-not (Test-Path -LiteralPath $PythonPath)) {
            throw 'LuxDex Python environment is missing. Run .\scripts\bootstrap.ps1 first.'
        }
        $previousDatabaseUrl = $env:DATABASE_URL
        try {
            $env:DATABASE_URL = $DatabaseUrl
            $arguments = @('-m', 'app.ingestion.penumbra.cli', 'load')
            if ($Source) {
                $arguments += @('--source', $Source)
            }
            & $PythonPath @arguments
        } finally {
            $env:DATABASE_URL = $previousDatabaseUrl
        }
    } else {
        if ($Source) {
            throw '-Source requires -DatabaseUrl because custom host paths are not copied into the app container.'
        }
        & docker compose --project-name luxdex --file $ComposeFile run --rm --build app `
            python -m app.ingestion.penumbra.cli load
    }

    if ($LASTEXITCODE -ne 0) {
        throw "Penumbra database build failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}
