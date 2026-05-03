#requires -version 5.0
# Hidden uninstaller. Removes the boot service and the Start Menu
# shortcut; preserves config.json under %ProgramData%\Fitro360.

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName PresentationFramework | Out-Null
function Show-Msg { param([string]$Text,[string]$Title='Fitro360 Relay',[string]$Icon='Information')
  [System.Windows.MessageBox]::Show($Text,$Title,'OK',$Icon) | Out-Null }

$exe = Join-Path $PSScriptRoot 'fitro360-relay.exe'
if (-not (Test-Path -LiteralPath $exe)) {
  Show-Msg 'fitro360-relay.exe not found next to uninstall.ps1.' 'Fitro360 - uninstall error' 'Error'
  exit 1
}

$confirm = [System.Windows.MessageBox]::Show(
  "Remove the Fitro360 Relay service and Start Menu shortcut?`n`nYour config.json under C:\ProgramData\Fitro360 will be preserved - delete that folder by hand if you also want to wipe stored device secrets.",
  'Fitro360 - confirm uninstall','YesNo','Question')
if ($confirm -ne 'Yes') { exit 0 }

$logOut = Join-Path $env:TEMP 'fitro360-uninstall.log'
$p = Start-Process -FilePath $exe -ArgumentList @('--uninstall-service') `
  -Wait -PassThru -WindowStyle Hidden `
  -RedirectStandardOutput $logOut -RedirectStandardError "$logOut.err"
if ($p.ExitCode -ne 0) {
  Show-Msg "Uninstall failed (code $($p.ExitCode)). See $logOut" 'Fitro360 - uninstall failed' 'Error'
  exit 1
}

# Best-effort: remove the Start Menu shortcut left by Install.
try {
  $lnk = Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\Fitro360 Relay.lnk'
  if (Test-Path -LiteralPath $lnk) { Remove-Item -LiteralPath $lnk -Force -ErrorAction SilentlyContinue }
} catch {}

Show-Msg 'The Fitro360 Relay service has been removed.' 'Fitro360 - uninstalled'
