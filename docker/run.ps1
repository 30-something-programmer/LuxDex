[CmdletBinding(DefaultParameterSetName = 'Menu')]
param(
    [Parameter(ParameterSetName = 'Start')][switch]$Start,
    [Parameter(ParameterSetName = 'Stop')][switch]$Stop,
    [Parameter(ParameterSetName = 'Restart')][switch]$Restart,
    [Parameter(ParameterSetName = 'Rebuild')][switch]$Rebuild,
    [Parameter(ParameterSetName = 'Blowaway')][switch]$Blowaway,
    [Parameter(ParameterSetName = 'Status')][switch]$Status,
    [Parameter(ParameterSetName = 'Logs')][switch]$Logs,
    [Parameter(ParameterSetName = 'Logs')][ValidateSet('db', 'app', 'web')][string]$Service
)

$ErrorActionPreference = 'Stop'
$ComposeFile = Join-Path $PSScriptRoot 'compose.yml'

function Invoke-LuxDexCompose {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

    & docker compose --project-name luxdex --file $ComposeFile @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose failed with exit code $LASTEXITCODE"
    }
}

function Start-LuxDex { Invoke-LuxDexCompose up --detach }
function Stop-LuxDex { Invoke-LuxDexCompose stop }
function Restart-LuxDex { Invoke-LuxDexCompose restart }

function Rebuild-LuxDex {
    Invoke-LuxDexCompose build --no-cache
    Invoke-LuxDexCompose up --detach
}

function Remove-And-RebuildLuxDex {
    Write-Warning 'FULL BLOWAWAY removes LuxDex containers, the LuxDex database volume, and LuxDex service images.'
    $confirmation = Read-Host 'Type BLOWAWAY to continue'
    if ($confirmation -cne 'BLOWAWAY') {
        Write-Host 'Full Blowaway cancelled.'
        return
    }

    Invoke-LuxDexCompose down --volumes --remove-orphans --rmi all
    Invoke-LuxDexCompose build --no-cache
    Invoke-LuxDexCompose up --detach
}

function Show-LuxDexStatus { Invoke-LuxDexCompose ps }

function Show-LuxDexLogs {
    param([string]$SelectedService)

    if ($SelectedService) {
        Invoke-LuxDexCompose logs --tail 200 $SelectedService
    } else {
        Invoke-LuxDexCompose logs --tail 200
    }
}

function Show-Menu {
    while ($true) {
        Write-Host ''
        Write-Host 'LuxDex Docker lifecycle'
        Write-Host '1. Start'
        Write-Host '2. Stop'
        Write-Host '3. Restart'
        Write-Host '4. Rebuild (no cache)'
        Write-Host '5. FULL BLOWAWAY (destructive: removes LuxDex volumes/images)'
        Write-Host '6. Status'
        Write-Host '7. Logs'
        Write-Host '8. Exit'

        switch (Read-Host 'Choose an action') {
            '1' { Start-LuxDex }
            '2' { Stop-LuxDex }
            '3' { Restart-LuxDex }
            '4' { Rebuild-LuxDex }
            '5' { Remove-And-RebuildLuxDex }
            '6' { Show-LuxDexStatus }
            '7' {
                $logService = Read-Host 'Service (db/app/web, or Enter for all)'
                if ($logService -and $logService -notin @('db', 'app', 'web')) {
                    Write-Warning 'Unknown service. Showing combined logs.'
                    $logService = $null
                }
                Show-LuxDexLogs -SelectedService $logService
            }
            '8' { return }
            default { Write-Warning 'Choose a number from 1 to 8.' }
        }
    }
}

switch ($PSCmdlet.ParameterSetName) {
    'Start' { Start-LuxDex }
    'Stop' { Stop-LuxDex }
    'Restart' { Restart-LuxDex }
    'Rebuild' { Rebuild-LuxDex }
    'Blowaway' { Remove-And-RebuildLuxDex }
    'Status' { Show-LuxDexStatus }
    'Logs' { Show-LuxDexLogs -SelectedService $Service }
    default { Show-Menu }
}

