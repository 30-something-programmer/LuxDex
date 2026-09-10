# LuxForge Docker Manager Template: 1.1.0
# LuxForge Docker Manager Content Hash: 1e8c7a1daaaf0c3ef4addaa89ac10a5823e9658595ce8b4f602727d47a34ad8e
[CmdletBinding(DefaultParameterSetName = 'Menu')]
param(
    [Parameter(ParameterSetName = 'Start')]
    [switch]$Start,

    [Parameter(ParameterSetName = 'Stop')]
    [switch]$Stop,

    [Parameter(ParameterSetName = 'Restart')]
    [switch]$Restart,

    [Parameter(ParameterSetName = 'Rebuild')]
    [switch]$Rebuild,

    [Parameter(ParameterSetName = 'Blowaway')]
    [switch]$Blowaway,

    [Parameter(ParameterSetName = 'Status')]
    [switch]$Status,

    [Parameter(ParameterSetName = 'Logs')]
    [switch]$Logs,

    [Parameter(ParameterSetName = 'Logs', Position = 0)]
    [string]$Service
)

$ErrorActionPreference = 'Stop'

# Docker Manager copies this file, then replaces only this menu label.
$DisplayName = 'LuxDex'

$composeFileNames = @('compose.yml', 'compose.yaml', 'docker-compose.yml', 'docker-compose.yaml')
$composeCandidates = @(
    $composeFileNames |
        ForEach-Object { Join-Path $PSScriptRoot $_ } |
        Where-Object { Test-Path -LiteralPath $_ -PathType Leaf }
)
if ($composeCandidates.Count -eq 0) {
    throw "No Compose file found beside $PSCommandPath."
}
if ($composeCandidates.Count -gt 1) {
    throw "Multiple Compose files found beside ${PSCommandPath}: $($composeCandidates -join ', ')"
}
$ComposeFile = $composeCandidates[0]

$composeText = Get-Content -LiteralPath $ComposeFile -Raw
$projectNameMatch = [regex]::Match($composeText, '(?m)^name:\s*[''"]?([^\s#''"]+)')
if ($projectNameMatch.Success) {
    $ProjectName = $projectNameMatch.Groups[1].Value
} else {
    $ProjectName = ([IO.Path]::GetFileName($PSScriptRoot.TrimEnd('\')).ToLowerInvariant() -replace '[^a-z0-9_-]+', '-')
}

function Assert-DockerCompose {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Docker CLI was not found on PATH. Install or start Docker Desktop and try again.'
    }

    & docker compose version *> $null
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker Compose is unavailable. Docker Desktop may still be starting.'
    }

    if (-not (Test-Path -LiteralPath $ComposeFile -PathType Leaf)) {
        throw "Compose file not found: $ComposeFile"
    }
}

function Invoke-Compose {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory, Position = 0)]
        [string[]]$ArgumentList,

        [switch]$Capture
    )

    Assert-DockerCompose

    if ($Capture) {
        $output = @(& docker compose --project-name $ProjectName --file $ComposeFile @ArgumentList 2>&1)
        $exitCode = $LASTEXITCODE
        if ($exitCode -ne 0) {
            $detail = ($output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
            throw "docker compose failed with exit code $exitCode.`n$detail"
        }
        return $output
    }

    & docker compose --project-name $ProjectName --file $ComposeFile @ArgumentList
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose failed with exit code $LASTEXITCODE."
    }
}

function Get-AllServices {
    @(
        Invoke-Compose @('config', '--services') -Capture |
            ForEach-Object { $_.ToString().Trim() } |
            Where-Object { $_ }
    )
}

function Get-RunningServices {
    @(
        Invoke-Compose @('ps', '--services', '--status', 'running') -Capture |
            ForEach-Object { $_.ToString().Trim() } |
            Where-Object { $_ }
    )
}

function Invoke-Start {
    $allServices = @(Get-AllServices)
    $runningServices = @(Get-RunningServices)
    $stoppedServices = @($allServices | Where-Object { $runningServices -notcontains $_ })

    if ($allServices.Count -gt 0 -and $stoppedServices.Count -eq 0) {
        Write-Host 'Everything is already running.' -ForegroundColor Yellow
        return
    }

    Invoke-Compose @('up', '--detach', '--remove-orphans')
}

function Invoke-Stop {
    if (@(Get-RunningServices).Count -eq 0) {
        Write-Host 'Nothing is running.' -ForegroundColor Yellow
        return
    }

    Invoke-Compose @('stop')
}

function Invoke-Restart {
    if (@(Get-RunningServices).Count -eq 0) {
        Write-Host 'Nothing is running; use Start instead.' -ForegroundColor Yellow
        return
    }

    Invoke-Compose @('restart')
}

function Invoke-Rebuild {
    Invoke-Compose @('build', '--no-cache')
    Invoke-Compose @('up', '--detach', '--remove-orphans')
}

function Invoke-Blowaway {
    Write-Warning "FULL BLOWAWAY removes $DisplayName containers, volumes, networks, and service images."
    Write-Warning 'Persistent development data may be destroyed.'
    $requiredText = "BLOWAWAY $ProjectName"
    $confirmation = Read-Host "Type '$requiredText' to continue"

    if ($confirmation -cne $requiredText) {
        Write-Host 'Full blowaway cancelled.' -ForegroundColor Yellow
        return
    }

    Invoke-Compose @('down', '--volumes', '--remove-orphans', '--rmi', 'all')
    Invoke-Compose @('build', '--no-cache')
    Invoke-Compose @('up', '--detach', '--remove-orphans')
}

function Show-Status {
    Invoke-Compose @('ps')
}

function Show-Logs {
    param([string]$SelectedService)

    if ($SelectedService) {
        $services = @(Get-AllServices)
        if ($services -notcontains $SelectedService) {
            throw "Unknown service '$SelectedService'. Available services: $($services -join ', ')"
        }
        Invoke-Compose @('logs', '--tail', '200', $SelectedService)
        return
    }

    Invoke-Compose @('logs', '--tail', '200')
}

function Show-Menu {
    while ($true) {
        Write-Host ''
        Write-Host "$DisplayName Docker lifecycle" -ForegroundColor Cyan
        Write-Host '1. Start'
        Write-Host '2. Stop'
        Write-Host '3. Restart'
        Write-Host '4. Rebuild (no cache)'
        Write-Host '5. Status'
        Write-Host '6. Logs'
        Write-Host '7. FULL BLOWAWAY (destructive)'
        Write-Host '8. Exit'

        switch ((Read-Host 'Choose an action').Trim()) {
            '1' { Invoke-Start }
            '2' { Invoke-Stop }
            '3' { Invoke-Restart }
            '4' { Invoke-Rebuild }
            '5' { Show-Status }
            '6' {
                $availableServices = @(Get-AllServices)
                Write-Host "Services: $($availableServices -join ', ')"
                $selectedService = (Read-Host 'Service, or Enter for all').Trim()
                Show-Logs -SelectedService $selectedService
            }
            '7' { Invoke-Blowaway }
            '8' { return }
            default { Write-Warning 'Choose a number from 1 to 8.' }
        }
    }
}

switch ($PSCmdlet.ParameterSetName) {
    'Start' { Invoke-Start }
    'Stop' { Invoke-Stop }
    'Restart' { Invoke-Restart }
    'Rebuild' { Invoke-Rebuild }
    'Blowaway' { Invoke-Blowaway }
    'Status' { Show-Status }
    'Logs' { Show-Logs -SelectedService $Service }
    default { Show-Menu }
}
