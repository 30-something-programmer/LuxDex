[CmdletBinding()]
param(
    [string]$DatabaseUrl
)

$ErrorActionPreference = 'Stop'
$RepositoryRoot = Split-Path -Parent $PSScriptRoot

Push-Location $RepositoryRoot
try {
    $Arguments = @('-m', 'app.geography.cli')
    if ($DatabaseUrl) {
        $Arguments += @('--database-url', $DatabaseUrl)
    }
    python @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Geography build failed with exit code $LASTEXITCODE"
    }
}
finally {
    Pop-Location
}
