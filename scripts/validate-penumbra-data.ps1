[CmdletBinding()]
param(
    [string]$Source
)

$ErrorActionPreference = 'Stop'
$RepositoryRoot = Split-Path -Parent $PSScriptRoot
$PythonPath = Join-Path $RepositoryRoot '.venvs\app\Scripts\python.exe'

if (-not (Test-Path -LiteralPath $PythonPath)) {
    throw 'LuxDex Python environment is missing. Run .\scripts\bootstrap.ps1 first.'
}

$arguments = @('-m', 'app.ingestion.penumbra.cli', 'validate')
if ($Source) {
    $arguments += @('--source', $Source)
}

Push-Location $RepositoryRoot
try {
    & $PythonPath @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Penumbra validation failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}
