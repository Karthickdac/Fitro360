#requires -version 5.0
# -----------------------------------------------------------------
#  Fitro360 Relay Agent - installer orchestrator (no console UI).
#
#  Lives in <release>\lib\ alongside the .exe and helper scripts.
#  Launched (hidden, elevated) by ..\Install.bat. All user-facing
#  output is via WPF MessageBox so no console window ever appears.
# -----------------------------------------------------------------

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName PresentationFramework | Out-Null

function Show-Msg {
  param([string]$Text, [string]$Title = 'Fitro360 Relay', [string]$Icon = 'Information')
  [System.Windows.MessageBox]::Show($Text, $Title, 'OK', $Icon) | Out-Null
}

$here = $PSScriptRoot                       # ...\release\lib
$exe  = Join-Path $here 'fitro360-relay.exe'
$gui  = Join-Path $here 'setup-gui.ps1'
$mgr  = Join-Path $here 'manager.ps1'

if (-not (Test-Path -LiteralPath $exe)) {
  Show-Msg "fitro360-relay.exe was not found in:`n$here`n`nPlease re-extract the entire release zip and try again." 'Fitro360 - install error' 'Error'
  exit 1
}
if (-not (Test-Path -LiteralPath $gui)) {
  Show-Msg "setup-gui.ps1 is missing from the lib folder." 'Fitro360 - install error' 'Error'
  exit 1
}

# Verify we are elevated (Install.bat already requested it).
$pri = [Security.Principal.WindowsIdentity]::GetCurrent()
$isAdmin = (New-Object Security.Principal.WindowsPrincipal $pri).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Show-Msg "The installer needs administrator rights. Right-click Install.bat and choose Run as administrator." 'Fitro360 - install error' 'Error'
  exit 1
}

# Clear "Mark of the Web" from sibling scripts (defense in depth).
try {
  Get-ChildItem -LiteralPath $here -Filter '*.ps1' -ErrorAction SilentlyContinue |
    ForEach-Object { Unblock-File -LiteralPath $_.FullName -ErrorAction SilentlyContinue }
} catch {}

# 1. Setup wizard. Use -WorkingDirectory + relative -File so paths
#    with spaces (e.g. "C:\Users\John Smith\...") don't break
#    Start-Process's no-quoting-of-array-elements behaviour.
$logErr = Join-Path $env:TEMP 'fitro360-wizard.err.log'
$logOut = Join-Path $env:TEMP 'fitro360-wizard.out.log'
if (Test-Path -LiteralPath $logErr) { Remove-Item -LiteralPath $logErr -Force -ErrorAction SilentlyContinue }

$wizard = Start-Process -FilePath 'powershell.exe' `
  -WorkingDirectory $here `
  -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File','setup-gui.ps1') `
  -Wait -PassThru -WindowStyle Hidden `
  -RedirectStandardOutput $logOut -RedirectStandardError $logErr

switch ($wizard.ExitCode) {
  0 { } # saved - proceed
  2 { exit 0 }   # user cancelled - silent
  default {
    $tail = ''
    if (Test-Path -LiteralPath $logErr) {
      try {
        $raw = Get-Content -LiteralPath $logErr -Raw -ErrorAction Stop
        if ($raw) { $tail = ($raw -split "`n" | Select-Object -Last 12) -join "`n" }
      } catch {}
    }
    if (-not $tail) { $tail = '(no error output captured)' }
    Show-Msg "The setup wizard exited with code $($wizard.ExitCode). Service was NOT installed.`n`nLast error output:`n$tail`n`nFull log: $logErr" 'Fitro360 - setup failed' 'Error'
    exit 1
  }
}

# 2. Register the boot service. The .exe is console-subsystem, so
#    -WindowStyle Hidden + redirected output keeps it invisible.
$svcOut = Join-Path $env:TEMP 'fitro360-install.log'
$svcErr = Join-Path $env:TEMP 'fitro360-install.err.log'
$svc = Start-Process -FilePath $exe -ArgumentList @('--install-service') `
  -Wait -PassThru -WindowStyle Hidden `
  -RedirectStandardOutput $svcOut -RedirectStandardError $svcErr
if ($svc.ExitCode -ne 0) {
  $tail = ''
  if (Test-Path -LiteralPath $svcErr) {
    try { $tail = (Get-Content -LiteralPath $svcErr -Tail 10) -join "`n" } catch {}
  }
  Show-Msg "Service registration failed (code $($svc.ExitCode)).`n`n$tail`n`nFull log: $svcOut" 'Fitro360 - install failed' 'Error'
  exit 1
}

# 3. Create a Start Menu shortcut so the operator can re-open the
#    manager later without finding this install folder again.
try {
  $startMenu = Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs'
  $lnkPath   = Join-Path $startMenu 'Fitro360 Relay.lnk'
  $shell = New-Object -ComObject WScript.Shell
  $sc = $shell.CreateShortcut($lnkPath)
  $sc.TargetPath       = 'powershell.exe'
  $sc.Arguments        = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$mgr`""
  $sc.WorkingDirectory = $here
  $sc.IconLocation     = "$exe,0"
  $sc.WindowStyle      = 7   # 7 = Minimized (the launcher window)
  $sc.Description      = 'Open the Fitro360 Relay manager'
  $sc.Save()
} catch {
  # Non-fatal - installer continues.
}

# 4. Open the manager window so the operator sees it's running.
Start-Process -FilePath 'powershell.exe' `
  -WorkingDirectory $here `
  -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File','manager.ps1') `
  -WindowStyle Hidden | Out-Null

exit 0
