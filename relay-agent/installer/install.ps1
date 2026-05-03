#requires -version 5.0
# ─────────────────────────────────────────────────────────────────
#  Fitro360 Relay Agent — installer orchestrator (no console UI).
#
#  Launched (hidden, elevated) by install.bat or
#  "Install Fitro360 Relay.vbs". All user-facing output is via
#  WPF MessageBox so no console window ever appears.
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

# Verify we are elevated (the launcher already requested it).
$pri = [Security.Principal.WindowsIdentity]::GetCurrent()
$isAdmin = (New-Object Security.Principal.WindowsPrincipal $pri).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Show-Msg "The installer needs administrator rights. Right-click install.bat and choose Run as administrator." 'Fitro360 — install error' 'Error'
  exit 1
}

# Clear "Mark of the Web" from sibling scripts so PowerShell doesn't
# refuse to load them when launched in a child process. Scripts
# extracted from a downloaded zip carry MOTW; -ExecutionPolicy Bypass
# normally handles it, but clearing it is belt-and-braces.
try {
  Get-ChildItem -LiteralPath $here -Filter '*.ps1' -ErrorAction SilentlyContinue |
    ForEach-Object { Unblock-File -LiteralPath $_.FullName -ErrorAction SilentlyContinue }
} catch {}

# 1. Setup wizard.
#
#    CRITICAL: Start-Process -ArgumentList does NOT quote array
#    elements containing spaces. If the install folder is under
#    e.g. "C:\Users\John Smith\Downloads\..." then passing
#    @('-File', $gui) becomes "-File C:\Users\John Smith\..." which
#    powershell.exe parses as "-File C:\Users\John" → exit code 1.
#
#    Fix: set -WorkingDirectory to the install folder and pass the
#    file by NAME ONLY (no spaces), so the new process's CWD does
#    the path resolution.
$logErr = Join-Path $env:TEMP 'fitro360-wizard.err.log'
if (Test-Path -LiteralPath $logErr) { Remove-Item -LiteralPath $logErr -Force -ErrorAction SilentlyContinue }
$logOut = Join-Path $env:TEMP 'fitro360-wizard.out.log'

$wizard = Start-Process -FilePath 'powershell.exe' `
  -WorkingDirectory $here `
  -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File','setup-gui.ps1') `
  -Wait -PassThru -WindowStyle Hidden `
  -RedirectStandardOutput $logOut -RedirectStandardError $logErr

switch ($wizard.ExitCode) {
  0 { } # saved — proceed
  2 { exit 0 }   # user cancelled — silent
  default {
    $tail = ''
    if (Test-Path -LiteralPath $logErr) {
      try {
        $raw = Get-Content -LiteralPath $logErr -Raw -ErrorAction Stop
        if ($raw) { $tail = ($raw -split "`n" | Select-Object -Last 12) -join "`n" }
      } catch {}
    }
    if (-not $tail) { $tail = '(no error output captured)' }
    Show-Msg "The setup wizard exited with code $($wizard.ExitCode). Service was NOT installed.`n`nLast error output:`n$tail`n`nFull log: $logErr" 'Fitro360 — setup failed' 'Error'
    exit 1
  }
}

# 2. Register the boot service. The .exe is a console-subsystem
#    binary, so Start-Process -WindowStyle Hidden + redirected output
#    is what actually keeps a flash of console from appearing.
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
  Show-Msg "Service registration failed (code $($svc.ExitCode)).`n`n$tail`n`nFull log: $svcOut" 'Fitro360 — install failed' 'Error'
  exit 1
}

# 3. Open the manager window so the operator sees it's running.
#    Same WorkingDirectory + relative-path trick as above.
if (Test-Path -LiteralPath $mgr) {
  Start-Process -FilePath 'powershell.exe' `
    -WorkingDirectory $here `
    -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File','manager.ps1') `
    -WindowStyle Hidden | Out-Null
} else {
  Show-Msg "Fitro360 Relay installed and started.`n`nConfig:  $env:ProgramData\Fitro360\config.json`nService: Fitro360Relay (auto-starts on boot)" 'Fitro360 — installed'
}

exit 0
