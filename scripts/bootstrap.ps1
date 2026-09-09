[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$RepositoryRoot = Split-Path -Parent $PSScriptRoot
$EnvironmentPath = Join-Path $RepositoryRoot '.venvs\app'
$PythonPath = Join-Path $EnvironmentPath 'Scripts\python.exe'

if (-not (Test-Path -LiteralPath $PythonPath)) {
    python -m venv $EnvironmentPath
}

& $PythonPath -m pip install --upgrade pip
& $PythonPath -m pip install --editable "$RepositoryRoot\build[dev]"

Push-Location (Join-Path $RepositoryRoot 'web')
try {
    pnpm install --frozen-lockfile
} finally {
    Pop-Location
}

Write-Host "LuxDex development environment is ready at $EnvironmentPath"

