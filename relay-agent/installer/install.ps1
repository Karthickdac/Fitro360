#requires -version 5.0
# ─────────────────────────────────────────────────────────────────
#  Fitro360 Relay Agent — installer orchestrator (no console UI).
#
#  Launched (hidden, elevated) by `Install Fitro360 Relay.vbs`.
#  All user-facing output is via WinForms / WPF MessageBox so no
#  console window ever appears.
# ─────────────────────────────────────────────────────────────────

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName PresentationFramework | Out-Null

function Show-Msg {
  param([string]$Text, [string]$Title = 'Fitro360 Relay', [string]$Icon = 'Information')
  [System.Windows.MessageBox]::Show($Text, $Title, 'OK', $Icon) | Out-Null
}

$here = $PSScriptRoot
$exe  = Join-Path $here 'fitro360-relay.exe'
$gui  = Join-Path $here 'setup-gui.ps1'
$mgr  = Join-Path $here 'manager.ps1'

if (-not (Test-Path -LiteralPath $exe)) {
  Show-Msg "fitro360-relay.exe was not found in:`n$here`n`nPlease re-extract the entire release zip and try again." 'Fitro360 — install error' 'Error'
  exit 1
}
if (-not (Test-Path -LiteralPath $gui)) {
  Show-Msg "setup-gui.ps1 is missing from the release folder." 'Fitro360 — install error' 'Error'
  exit 1
}

# Verify we are elevated (the VBS launcher already requested it).
$pri = [Security.Principal.WindowsIdentity]::GetCurrent()
$isAdmin = (New-Object Security.Principal.WindowsPrincipal $pri).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Show-Msg "The installer needs administrator rights. Right-click `"Install Fitro360 Relay.vbs`" and choose Run as administrator." 'Fitro360 — install error' 'Error'
  exit 1
}

# 1. Setup wizard. Spawn as a hidden child PowerShell so its `exit`
#    code propagates without killing this orchestrator.
$wizard = Start-Process -FilePath 'powershell.exe' -ArgumentList @(
  '-NoProfile','-ExecutionPolicy','Bypass','-File', $gui
) -Wait -PassThru -WindowStyle Hidden
switch ($wizard.ExitCode) {
  0 { } # saved — proceed
  2 { exit 0 }   # user cancelled — silent
  default {
    Show-Msg "The setup wizard exited unexpectedly (code $($wizard.ExitCode)). Service was NOT installed." 'Fitro360 — setup failed' 'Error'
    exit 1
  }
}

# 2. Register the boot service. The .exe is a console-subsystem
#    binary, so Start-Process -WindowStyle Hidden + redirected output
#    is what actually keeps a flash of console from appearing.
$logOut = Join-Path $env:TEMP 'fitro360-install.log'
$logErr = Join-Path $env:TEMP 'fitro360-install.err.log'
$svc = Start-Process -FilePath $exe -ArgumentList @('--install-service') `
  -Wait -PassThru -WindowStyle Hidden `
  -RedirectStandardOutput $logOut -RedirectStandardError $logErr
if ($svc.ExitCode -ne 0) {
  $tail = ''
  if (Test-Path -LiteralPath $logErr) {
    try { $tail = (Get-Content -LiteralPath $logErr -Tail 10) -join "`n" } catch {}
  }
  Show-Msg "Service registration failed (code $($svc.ExitCode)).`n`n$tail`n`nFull log: $logOut" 'Fitro360 — install failed' 'Error'
  exit 1
}

# 3. Open the manager window so the operator sees it's running.
if (Test-Path -LiteralPath $mgr) {
  Start-Process -FilePath 'powershell.exe' -ArgumentList @(
    '-NoProfile','-ExecutionPolicy','Bypass','-File', $mgr
  ) -WindowStyle Hidden | Out-Null
} else {
  Show-Msg "Fitro360 Relay installed and started.`n`nConfig:  $env:ProgramData\Fitro360\config.json`nService: Fitro360Relay (auto-starts on boot)" 'Fitro360 — installed'
}

exit 0
