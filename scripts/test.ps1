[CmdletBinding(DefaultParameterSetName = 'Unit')]
param(
    [Parameter(ParameterSetName = 'Unit')][switch]$Unit,
    [Parameter(ParameterSetName = 'Integration')][switch]$Integration,
    [Parameter(ParameterSetName = 'All')][switch]$All
)

$ErrorActionPreference = 'Stop'
$RepositoryRoot = Split-Path -Parent $PSScriptRoot
$PythonPath = Join-Path $RepositoryRoot '.venvs\app\Scripts\python.exe'
$ComposeFile = Join-Path $RepositoryRoot 'docker\compose.yml'

function Invoke-BackendUnitTests {
    if (-not (Test-Path -LiteralPath $PythonPath)) {
        throw 'LuxDex Python environment is missing. Run .\scripts\bootstrap.ps1 first.'
    }

    Write-Host '==> Backend unit tests (pytest, no database required)' -ForegroundColor Cyan
    Push-Location (Join-Path $RepositoryRoot 'build')
    try {
        & $PythonPath -m pytest -q
        if ($LASTEXITCODE -ne 0) {
            throw "Backend unit tests failed with exit code $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }
}

function Invoke-FrontendTests {
    Write-Host '==> Frontend tests (vitest)' -ForegroundColor Cyan
    Push-Location (Join-Path $RepositoryRoot 'web')
    try {
        pnpm test
        if ($LASTEXITCODE -ne 0) {
            throw "Frontend tests failed with exit code $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }
}

function Invoke-BackendIntegrationTests {
    Write-Host '==> Backend database integration tests (disposable container on luxdex-internal)' -ForegroundColor Cyan

    & docker compose --project-name luxdex --file $ComposeFile up --detach db
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not start luxdex-db.'
    }

    & docker compose --project-name luxdex --file $ComposeFile --profile test build test
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not build the luxdex-test image.'
    }

    & docker compose --project-name luxdex --file $ComposeFile --profile test run --rm test
    if ($LASTEXITCODE -ne 0) {
        throw "Backend database integration tests failed with exit code $LASTEXITCODE"
    }
}

switch ($PSCmdlet.ParameterSetName) {
    'Integration' { Invoke-BackendIntegrationTests }
    'All' {
        Invoke-BackendUnitTests
        Invoke-FrontendTests
        Invoke-BackendIntegrationTests
    }
    default {
        Invoke-BackendUnitTests
        Invoke-FrontendTests
    }
}

Write-Host 'All requested test suites passed.' -ForegroundColor Green
