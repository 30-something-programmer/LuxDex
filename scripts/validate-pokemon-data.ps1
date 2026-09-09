[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$RepositoryRoot = Split-Path -Parent $PSScriptRoot
$PythonPath = Join-Path $RepositoryRoot '.venvs\app\Scripts\python.exe'

if (-not (Test-Path -LiteralPath $PythonPath)) {
    throw 'LuxDex Python environment is missing. Run .\scripts\bootstrap.ps1 first.'
}

Push-Location $RepositoryRoot
try {
    & $PythonPath -m app.ingestion.pokemon.cli validate
    if ($LASTEXITCODE -ne 0) {
        throw "Pokémon validation failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}

