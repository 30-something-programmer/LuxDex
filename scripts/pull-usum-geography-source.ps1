[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$RepositoryRoot = Split-Path -Parent $PSScriptRoot

Push-Location $RepositoryRoot
try {
    python -m app.geography.acquire
    if ($LASTEXITCODE -ne 0) {
        throw "USUM geography source acquisition failed with exit code $LASTEXITCODE"
    }
}
finally {
    Pop-Location
}
