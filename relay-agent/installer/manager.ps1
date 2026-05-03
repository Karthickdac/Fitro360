#requires -version 5.0
# ─────────────────────────────────────────────────────────────────────
#  Fitro360 Relay Manager — small "control panel" window.
#
#  Shows the live state of the Fitro360Relay scheduled task, the
#  configured devices, and the latest log lines. Buttons let the
#  operator start / stop / reconfigure the agent and tail the logs
#  without ever touching a command prompt.
#
#  Self-elevates if the user launches it without admin rights, since
#  start/stop and Save & install all need elevation.
# ─────────────────────────────────────────────────────────────────────

[CmdletBinding()]
param(
  [string]$ConfigPath = (Join-Path $env:ProgramData 'Fitro360\config.json'),
  [string]$LogPath    = (Join-Path $env:ProgramData 'Fitro360\agent.log'),
  [string]$ExePath    = $null
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Self-elevate.
$pri = [Security.Principal.WindowsIdentity]::GetCurrent()
$isAdmin = (New-Object Security.Principal.WindowsPrincipal $pri).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList @(
    '-NoProfile','-ExecutionPolicy','Bypass','-File',$PSCommandPath,
    '-ConfigPath',$ConfigPath,'-LogPath',$LogPath
  )
  exit
}

if (-not $ExePath) {
  $candidate = Join-Path $PSScriptRoot 'fitro360-relay.exe'
  if (Test-Path -LiteralPath $candidate) { $ExePath = $candidate }
  else { $ExePath = Join-Path (Split-Path -Parent $PSScriptRoot) 'fitro360-relay.exe' }
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$TASK = 'Fitro360Relay'

function Get-TaskState {
  # Run schtasks.exe via a hidden Start-Process so no console flashes
  # while the manager auto-refreshes every 5 sec.
  $tmp = Join-Path $env:TEMP 'fitro360-mgr-status.csv'
  $p = Start-Process -FilePath 'schtasks.exe' `
        -ArgumentList @('/Query','/TN',$TASK,'/FO','CSV','/NH') `
        -Wait -PassThru -WindowStyle Hidden `
        -RedirectStandardOutput $tmp -RedirectStandardError "$tmp.err"
  if ($p.ExitCode -ne 0) { return 'Not installed' }
  try {
    $cols = (Get-Content -LiteralPath $tmp -Raw) | ConvertFrom-Csv -Header 'Name','NextRun','Status'
    return $cols[0].Status
  } catch { return 'Unknown' }
}

function Run-Exe([string[]]$args) {
  if (-not (Test-Path -LiteralPath $ExePath)) {
    [System.Windows.Forms.MessageBox]::Show(
      "fitro360-relay.exe not found at:`n$ExePath`n`nMove this manager.ps1 next to the .exe.",
      'Missing binary','OK','Error') | Out-Null
    return
  }
  # WindowStyle Hidden — the .exe is a console-subsystem binary, so
  # without this a black console window flashes for each click.
  $logOut = Join-Path $env:TEMP 'fitro360-mgr.log'
  Start-Process -FilePath $ExePath -ArgumentList $args -Wait `
    -WindowStyle Hidden `
    -RedirectStandardOutput $logOut -RedirectStandardError "$logOut.err" | Out-Null
}

# ─── Main window ──────────────────────────────────────────────────
$form = New-Object System.Windows.Forms.Form
$form.Text = 'Fitro360 Relay Manager'
$form.StartPosition = 'CenterScreen'
$form.Size = New-Object System.Drawing.Size(720, 560)
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false

# Status pill
$lblTitle = New-Object System.Windows.Forms.Label
$lblTitle.Text = 'Service status'
$lblTitle.Font = New-Object System.Drawing.Font('Segoe UI', 9)
$lblTitle.ForeColor = [System.Drawing.Color]::DimGray
$lblTitle.Location = New-Object System.Drawing.Point(20, 15)
$lblTitle.Size = New-Object System.Drawing.Size(120, 18)
$form.Controls.Add($lblTitle)

$lblStatus = New-Object System.Windows.Forms.Label
$lblStatus.Text = '...'
$lblStatus.Font = New-Object System.Drawing.Font('Segoe UI', 16, [System.Drawing.FontStyle]::Bold)
$lblStatus.Location = New-Object System.Drawing.Point(20, 33)
$lblStatus.Size = New-Object System.Drawing.Size(380, 32)
$form.Controls.Add($lblStatus)

# Action buttons
$btnStart = New-Object System.Windows.Forms.Button
$btnStart.Text = 'Start'
$btnStart.Location = New-Object System.Drawing.Point(420, 25)
$btnStart.Size = New-Object System.Drawing.Size(85, 32)
$btnStart.Add_Click({ Run-Exe @('--start-service'); Refresh-All })
$form.Controls.Add($btnStart)

$btnStop = New-Object System.Windows.Forms.Button
$btnStop.Text = 'Stop'
$btnStop.Location = New-Object System.Drawing.Point(510, 25)
$btnStop.Size = New-Object System.Drawing.Size(85, 32)
$btnStop.Add_Click({ Run-Exe @('--stop-service'); Refresh-All })
$form.Controls.Add($btnStop)

$btnRestart = New-Object System.Windows.Forms.Button
$btnRestart.Text = 'Restart'
$btnRestart.Location = New-Object System.Drawing.Point(600, 25)
$btnRestart.Size = New-Object System.Drawing.Size(85, 32)
$btnRestart.Add_Click({ Run-Exe @('--stop-service'); Run-Exe @('--start-service'); Refresh-All })
$form.Controls.Add($btnRestart)

# Devices list
$grpDev = New-Object System.Windows.Forms.GroupBox
$grpDev.Text = 'Configured devices'
$grpDev.Location = New-Object System.Drawing.Point(20, 80)
$grpDev.Size = New-Object System.Drawing.Size(665, 180)
$form.Controls.Add($grpDev)

$lstDev = New-Object System.Windows.Forms.ListView
$lstDev.View = 'Details'
$lstDev.FullRowSelect = $true
$lstDev.GridLines = $true
$lstDev.Location = New-Object System.Drawing.Point(10, 22)
$lstDev.Size = New-Object System.Drawing.Size(645, 145)
[void]$lstDev.Columns.Add('Brand', 80)
[void]$lstDev.Columns.Add('Serial', 180)
[void]$lstDev.Columns.Add('Host', 180)
[void]$lstDev.Columns.Add('Port', 60)
[void]$lstDev.Columns.Add('Username', 130)
$grpDev.Controls.Add($lstDev)

# Log tail
$grpLog = New-Object System.Windows.Forms.GroupBox
$grpLog.Text = 'Recent log lines'
$grpLog.Location = New-Object System.Drawing.Point(20, 270)
$grpLog.Size = New-Object System.Drawing.Size(665, 195)
$form.Controls.Add($grpLog)

$txtLog = New-Object System.Windows.Forms.TextBox
$txtLog.Multiline = $true
$txtLog.ReadOnly = $true
$txtLog.ScrollBars = 'Vertical'
$txtLog.Font = New-Object System.Drawing.Font('Consolas', 9)
$txtLog.Location = New-Object System.Drawing.Point(10, 22)
$txtLog.Size = New-Object System.Drawing.Size(645, 160)
$grpLog.Controls.Add($txtLog)

# Bottom buttons
$btnReconfigure = New-Object System.Windows.Forms.Button
$btnReconfigure.Text = 'Reconfigure...'
$btnReconfigure.Location = New-Object System.Drawing.Point(20, 480)
$btnReconfigure.Size = New-Object System.Drawing.Size(120, 30)
$btnReconfigure.Add_Click({
  $gui = Join-Path $PSScriptRoot 'setup-gui.ps1'
  if (-not (Test-Path -LiteralPath $gui)) {
    [System.Windows.Forms.MessageBox]::Show(
      "Couldn't find setup-gui.ps1 next to the manager.",
      'Missing file','OK','Error') | Out-Null
    return
  }
  $p = Start-Process -FilePath 'powershell.exe' -ArgumentList @(
    '-NoProfile','-ExecutionPolicy','Bypass','-File',$gui,
    '-ConfigPath',$ConfigPath
  ) -Wait -PassThru
  if ($p.ExitCode -eq 0) {
    Run-Exe @('--stop-service')
    Run-Exe @('--start-service')
    Refresh-All
  }
})
$form.Controls.Add($btnReconfigure)

$btnOpenConfig = New-Object System.Windows.Forms.Button
$btnOpenConfig.Text = 'Open config folder'
$btnOpenConfig.Location = New-Object System.Drawing.Point(150, 480)
$btnOpenConfig.Size = New-Object System.Drawing.Size(140, 30)
$btnOpenConfig.Add_Click({
  $dir = Split-Path -Parent $ConfigPath
  if (Test-Path -LiteralPath $dir) { Start-Process -FilePath 'explorer.exe' -ArgumentList $dir }
})
$form.Controls.Add($btnOpenConfig)

$btnRefresh = New-Object System.Windows.Forms.Button
$btnRefresh.Text = 'Refresh'
$btnRefresh.Location = New-Object System.Drawing.Point(530, 480)
$btnRefresh.Size = New-Object System.Drawing.Size(75, 30)
$btnRefresh.Add_Click({ Refresh-All })
$form.Controls.Add($btnRefresh)

$btnClose = New-Object System.Windows.Forms.Button
$btnClose.Text = 'Close'
$btnClose.Location = New-Object System.Drawing.Point(610, 480)
$btnClose.Size = New-Object System.Drawing.Size(75, 30)
$btnClose.DialogResult = 'OK'
$form.Controls.Add($btnClose)

function Refresh-All {
  # Status
  $state = Get-TaskState
  $lblStatus.Text = $state
  switch -Wildcard ($state) {
    'Running'        { $lblStatus.ForeColor = [System.Drawing.Color]::FromArgb(34,139,34) }
    'Ready'          { $lblStatus.ForeColor = [System.Drawing.Color]::FromArgb(180,140,0) }
    'Not installed'  { $lblStatus.ForeColor = [System.Drawing.Color]::FromArgb(200,40,40) }
    default          { $lblStatus.ForeColor = [System.Drawing.Color]::DimGray }
  }
  # Devices
  $lstDev.Items.Clear()
  if (Test-Path -LiteralPath $ConfigPath) {
    try {
      $cfg = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
      foreach ($d in $cfg.devices) {
        $i = New-Object System.Windows.Forms.ListViewItem($d.brand.ToUpper())
        [void]$i.SubItems.Add([string]$d.serial)
        [void]$i.SubItems.Add([string]$d.host)
        [void]$i.SubItems.Add([string]$d.port)
        [void]$i.SubItems.Add([string]($d.username))
        [void]$lstDev.Items.Add($i)
      }
    } catch {
      $i = New-Object System.Windows.Forms.ListViewItem('(error)')
      [void]$i.SubItems.Add($_.Exception.Message)
      [void]$lstDev.Items.Add($i)
    }
  }
  # Log tail (last ~200 lines)
  if (Test-Path -LiteralPath $LogPath) {
    try {
      $tail = Get-Content -LiteralPath $LogPath -Tail 200 -ErrorAction Stop
      $txtLog.Text = ($tail -join "`r`n")
      $txtLog.SelectionStart = $txtLog.Text.Length
      $txtLog.ScrollToCaret()
    } catch {
      $txtLog.Text = "Could not read log file: $($_.Exception.Message)"
    }
  } else {
    $txtLog.Text = "(no log file at $LogPath yet)"
  }
}

Refresh-All

# Auto-refresh status / log every 5 sec while the window is open.
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 5000
$timer.Add_Tick({ Refresh-All })
$timer.Start()
$form.Add_FormClosed({ $timer.Stop() })

[void]$form.ShowDialog()
