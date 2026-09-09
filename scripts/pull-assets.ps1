[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$RepositoryRoot = Split-Path -Parent $PSScriptRoot
$FontDirectory = Join-Path $RepositoryRoot 'web\public\assets\fonts'
New-Item -ItemType Directory -Force -Path $FontDirectory | Out-Null
$GoogleFontsRevision = 'baa2e5561af8a4873b058859dcfe158bdd033942'

$Assets = @(
    @{
        Url = "https://raw.githubusercontent.com/google/fonts/$GoogleFontsRevision/ofl/nunito/Nunito%5Bwght%5D.ttf"
        Destination = 'Nunito-Variable.ttf'
        Sha256 = 'BB55A5CA5C2042335B3991AF27C4D0705D0EF41CAC6164AC737FD8F2A1E85207'
    },
    @{
        Url = "https://raw.githubusercontent.com/google/fonts/$GoogleFontsRevision/ofl/nunito/OFL.txt"
        Destination = 'Nunito-LICENSE.txt'
        Sha256 = '580DF76C95A1EC5AB878CEB25BB3D85C6A076804E9C970C8C6972AEA775FDF65'
    },
    @{
        Url = "https://raw.githubusercontent.com/google/fonts/$GoogleFontsRevision/ofl/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf"
        Destination = 'JetBrainsMono-Variable.ttf'
        Sha256 = '48715A42EC242C21E9F02692891E147D022299A52E48D5E413E1A942193FFEDA'
    },
    @{
        Url = "https://raw.githubusercontent.com/google/fonts/$GoogleFontsRevision/ofl/jetbrainsmono/OFL.txt"
        Destination = 'JetBrainsMono-LICENSE.txt'
        Sha256 = 'B2FE5E8987594E9FFD1D2CA52A2F5D73EB8335243893C5D6254B5AD69269591D'
    }
)

foreach ($Asset in $Assets) {
    $DestinationPath = Join-Path $FontDirectory $Asset.Destination
    $DownloadPath = "$DestinationPath.download"
    Write-Host "Downloading $($Asset.Destination)"
    Invoke-WebRequest -Uri $Asset.Url -OutFile $DownloadPath

    $ActualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $DownloadPath).Hash
    if ($ActualHash -ne $Asset.Sha256) {
        Remove-Item -LiteralPath $DownloadPath -Force
        throw "Checksum mismatch for $($Asset.Destination): $ActualHash"
    }

    Move-Item -LiteralPath $DownloadPath -Destination $DestinationPath -Force
}

Write-Host "Local runtime fonts updated in $FontDirectory"
