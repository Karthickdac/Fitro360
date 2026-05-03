#requires -version 5.0
# ─────────────────────────────────────────────────────────────────
#  Fitro360 Relay Agent - installer orchestrator (no console UI).
#  Lives in <release>\lib\ alongside the .exe and helper scripts.
#  Launched (hidden, elevated) by ..\Install.bat.
# ─────────────────────────────────────────────────────────────────

[CmdletBinding()]
param()

# === Stage 1: tracing & error trap ==================================
# Write a trace marker at the VERY first line, before any Add-Type or
# StrictMode, so we can see in %TEMP%\fitro360-trace.log exactly how
# far we got even if everything that follows blows up.
$Trace = Join-Path $env:TEMP 'fitro360-trace.log'
function Write-Trace {
  param([string]$Msg)
  try { "[{0}] install.ps1: {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Msg | Out-File -LiteralPath $Trace -Encoding UTF8 -Append } catch {}
}
Write-Trace "started, PSScriptRoot='$PSScriptRoot', PID=$PID, IsAdmin=...checking"

# Top-level trap so ANY uncaught error in this script surfaces as a
# MessageBox AND lands in the trace log (instead of silently dying).
trap {
  Write-Trace ("UNCAUGHT: {0}`n  at: {1}" -f $_.Exception.Message, $_.InvocationInfo.PositionMessage)
  try {
    Add-Type -AssemblyName PresentationFramework -ErrorAction SilentlyContinue
    [System.Windows.MessageBox]::Show(
      ("Installer crashed:`n`n{0}`n`nDetails: $Trace" -f $_.Exception.Message),
      'Fitro360 - install error','OK','Error') | Out-Null
  } catch {}
  exit 1
}

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName PresentationFramework | Out-Null
Write-Trace "PresentationFramework loaded"

function Show-Msg {
  param([string]$Text, [string]$Title = 'Fitro360 Relay', [string]$Icon = 'Information')
  [System.Windows.MessageBox]::Show($Text, $Title, 'OK', $Icon) | Out-Null
}

$here = $PSScriptRoot                       # ...\release\lib
$exe  = Join-Path $here 'fitro360-relay.exe'
$gui  = Join-Path $here 'setup-gui.ps1'
$mgr  = Join-Path $here 'manager.ps1'
Write-Trace "paths: exe='$exe', gui='$gui'"

if (-not (Test-Path -LiteralPath $exe)) {
  Write-Trace "exe missing: $exe"
  Show-Msg "fitro360-relay.exe was not found in:`n$here`n`nPlease re-extract the entire release zip and try again." 'Fitro360 - install error' 'Error'
  exit 1
}
if (-not (Test-Path -LiteralPath $gui)) {
  Write-Trace "gui missing: $gui"
  Show-Msg "setup-gui.ps1 is missing from the lib folder." 'Fitro360 - install error' 'Error'
  exit 1
}

# Verify we are elevated.
$pri = [Security.Principal.WindowsIdentity]::GetCurrent()
$isAdmin = (New-Object Security.Principal.WindowsPrincipal $pri).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
Write-Trace "isAdmin=$isAdmin"
if (-not $isAdmin) {
  Show-Msg "The installer needs administrator rights. Right-click Install.bat and choose Run as administrator." 'Fitro360 - install error' 'Error'
  exit 1
}

# Clear MOTW from sibling scripts.
try {
  Get-ChildItem -LiteralPath $here -Filter '*.ps1' -ErrorAction SilentlyContinue |
    ForEach-Object { Unblock-File -LiteralPath $_.FullName -ErrorAction SilentlyContinue }
  Write-Trace "Unblock-File swept"
} catch { Write-Trace "Unblock-File error: $($_.Exception.Message)" }

# === Stage 2: setup wizard ==========================================
$logErr = Join-Path $env:TEMP 'fitro360-wizard.err.log'
$logOut = Join-Path $env:TEMP 'fitro360-wizard.out.log'
if (Test-Path -LiteralPath $logErr) { Remove-Item -LiteralPath $logErr -Force -ErrorAction SilentlyContinue }
Write-Trace "spawning setup-gui.ps1, WorkingDirectory='$here'"

$wizard = Start-Process -FilePath 'powershell.exe' `
  -WorkingDirectory $here `
  -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File','setup-gui.ps1') `
  -Wait -PassThru -WindowStyle Hidden `
  -RedirectStandardOutput $logOut -RedirectStandardError $logErr
Write-Trace "wizard exit=$($wizard.ExitCode)"

switch ($wizard.ExitCode) {
  0 { } # saved - proceed
  2 { Write-Trace "user cancelled"; exit 0 }
  default {
    $tail = ''
    if (Test-Path -LiteralPath $logErr) {
      try {
        $raw = Get-Content -LiteralPath $logErr -Raw -ErrorAction Stop
        if ($raw) { $tail = ($raw -split "`n" | Select-Object -Last 12) -join "`n" }
      } catch {}
    }
    if (-not $tail) { $tail = '(no error output captured)' }
    Show-Msg "The setup wizard exited with code $($wizard.ExitCode). Service was NOT installed.`n`nLast error output:`n$tail`n`nFull log: $logErr`nTrace: $Trace" 'Fitro360 - setup failed' 'Error'
    exit 1
  }
}

# === Stage 3: register boot service =================================
$svcOut = Join-Path $env:TEMP 'fitro360-install.log'
$svcErr = Join-Path $env:TEMP 'fitro360-install.err.log'
Write-Trace "registering service via $exe --install-service"
$svc = Start-Process -FilePath $exe -ArgumentList @('--install-service') `
  -Wait -PassThru -WindowStyle Hidden `
  -RedirectStandardOutput $svcOut -RedirectStandardError $svcErr
Write-Trace "service install exit=$($svc.ExitCode)"
if ($svc.ExitCode -ne 0) {
  $tail = ''
  if (Test-Path -LiteralPath $svcErr) {
    try { $tail = (Get-Content -LiteralPath $svcErr -Tail 10) -join "`n" } catch {}
  }
  Show-Msg "Service registration failed (code $($svc.ExitCode)).`n`n$tail`n`nFull log: $svcOut" 'Fitro360 - install failed' 'Error'
  exit 1
}

# === Stage 4: Start Menu shortcut ===================================
try {
  $startMenu = Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs'
  $lnkPath   = Join-Path $startMenu 'Fitro360 Relay.lnk'
  $shell = New-Object -ComObject WScript.Shell
  $sc = $shell.CreateShortcut($lnkPath)
  $sc.TargetPath       = 'powershell.exe'
  $sc.Arguments        = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$mgr`""
  $sc.WorkingDirectory = $here
  $sc.IconLocation     = "$exe,0"
  $sc.WindowStyle      = 7
  $sc.Description      = 'Open the Fitro360 Relay manager'
  $sc.Save()
  Write-Trace "Start Menu shortcut created at $lnkPath"
} catch {
  Write-Trace "Start Menu shortcut FAILED: $($_.Exception.Message)"
}

# === Stage 5: open manager window ===================================
Write-Trace "spawning manager.ps1"
Start-Process -FilePath 'powershell.exe' `
  -WorkingDirectory $here `
  -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File','manager.ps1') `
  -WindowStyle Hidden | Out-Null

Write-Trace "DONE"
exit 0
