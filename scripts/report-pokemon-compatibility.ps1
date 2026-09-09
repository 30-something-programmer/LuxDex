[CmdletBinding()]
param(
    [string]$DatabaseUrl
)

$ErrorActionPreference = 'Stop'
$RepositoryRoot = Split-Path -Parent $PSScriptRoot
$PythonPath = Join-Path $RepositoryRoot '.venvs\app\Scripts\python.exe'
$ComposeFile = Join-Path $RepositoryRoot 'docker\compose.yml'
$OutputPath = Join-Path $RepositoryRoot 'db\data\canonical\pokemon\penumbra-compatibility-report.json'

Push-Location $RepositoryRoot
try {
    if ($DatabaseUrl) {
        if (-not (Test-Path -LiteralPath $PythonPath)) {
            throw 'LuxDex Python environment is missing. Run .\scripts\bootstrap.ps1 first.'
        }
        & $PythonPath -m app.ingestion.pokemon.compatibility `
            --database-url $DatabaseUrl `
            --output $OutputPath
    } else {
        & docker compose --project-name luxdex --file $ComposeFile run --rm --no-deps `
            --volume "${RepositoryRoot}:/workspace" `
            --workdir /workspace `
            app python -m app.ingestion.pokemon.compatibility `
            --database-url postgresql://luxdex:luxdex-dev-only@db:5432/luxdex `
            --output /workspace/db/data/canonical/pokemon/penumbra-compatibility-report.json
    }
    if ($LASTEXITCODE -ne 0) {
        throw "Pokémon compatibility report failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}
