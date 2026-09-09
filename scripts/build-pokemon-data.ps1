[CmdletBinding()]
param(
    [string]$DatabaseUrl
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
        & $PythonPath -m app.ingestion.pokemon.cli load --database-url $DatabaseUrl
    } else {
        & docker compose --project-name luxdex --file $ComposeFile run --rm --build app `
            python -m app.ingestion.pokemon.cli load
    }
    if ($LASTEXITCODE -ne 0) {
        throw "Pokémon database build failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}
