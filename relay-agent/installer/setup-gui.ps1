#requires -version 5.0
# ---------------------------------------------------------------------
#  Fitro360 Relay Agent - Windows Forms setup wizard.
#
#  A native-looking GUI that replaces the CLI prompts. Collects the
#  same fields the .exe --setup wizard does, validates them, and
#  writes %ProgramData%\Fitro360\config.json with hardened ACLs.
#
#  Invoked by install.bat (which elevates first). Can also be run
#  later by double-clicking it from the install folder, or via the
#  "Reconfigure" button in the manager window.
#
#  Exit codes:
#    0  = config saved (caller should proceed to install service)
#    2  = user cancelled (caller should abort silently)
#    1  = unrecoverable error (caller should show its own message)
# ---------------------------------------------------------------------

[CmdletBinding()]
param(
  [string]$ConfigPath = (Join-Path $env:ProgramData 'Fitro360\config.json'),
  [string]$DefaultCloudUrl = 'https://app.fitro360.com'
)

# Trace marker at the very top, before StrictMode/Add-Type, so we
# can see in %TEMP%\fitro360-trace.log if this script even started.
$Trace = Join-Path $env:TEMP 'fitro360-trace.log'
try { "[{0}] setup-gui.ps1: started PID=$PID" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') | Out-File -LiteralPath $Trace -Encoding UTF8 -Append } catch {}

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Surface ANY uncaught exception as a MessageBox so the operator sees
# a real error instead of "exit code 1". Also writes a copy to TEMP.
trap {
  $errFile = Join-Path $env:TEMP 'fitro360-setup-gui.err.log'
  try {
    "[{0}] {1}`n{2}" -f (Get-Date), $_.Exception.Message, $_.ScriptStackTrace |
      Out-File -LiteralPath $errFile -Encoding UTF8 -Append
    "[{0}] setup-gui.ps1: CRASHED {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $_.Exception.Message |
      Out-File -LiteralPath $Trace -Encoding UTF8 -Append
  } catch {}
  try {
    Add-Type -AssemblyName PresentationFramework -ErrorAction SilentlyContinue
    [System.Windows.MessageBox]::Show(
      "The setup window crashed:`n`n$($_.Exception.Message)`n`nDetails written to:`n$errFile",
      'Fitro360 - setup error','OK','Error') | Out-Null
  } catch {}
  exit 1
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$KnownBrands = @(
  'zkteco','essl','realtime','hikvision','suprema',
  'matrix','anviz','dahua','idemia','virdi','hid'
)

# --- Load any existing config so re-running the wizard pre-fills the form ---
$existing = $null
if (Test-Path -LiteralPath $ConfigPath) {
  try { $existing = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json }
  catch { $existing = $null }
}

# Devices array used by the DataGridView. We keep secrets/passwords in
# a parallel hashtable keyed by serial, so they aren't displayed in the
# grid (only when the operator opens the row's Edit dialog).
$devices = New-Object System.Collections.ArrayList
if ($existing -and $existing.devices) {
  foreach ($d in $existing.devices) {
    [void]$devices.Add([pscustomobject]@{
      brand    = $d.brand
      serial   = $d.serial
      host     = $d.host
      port     = [int]$d.port
      username = if ($d.PSObject.Properties['username']) { [string]$d.username } else { '' }
      secret   = $d.secret
      password = if ($d.PSObject.Properties['password']) { [string]$d.password } else { '' }
    })
  }
}

# ---------------------------------------------------------------------
#  Device editor sub-dialog. Returns $null on cancel, otherwise a
#  pscustomobject with all fields populated.
# ---------------------------------------------------------------------
function Show-DeviceDialog {
  param($Device)

  $isEdit = $null -ne $Device
  $form = New-Object System.Windows.Forms.Form
  $form.Text = if ($isEdit) { "Edit device - $($Device.serial)" } else { 'Add biometric device' }
  $form.StartPosition = 'CenterParent'
  $form.FormBorderStyle = 'FixedDialog'
  $form.MaximizeBox = $false
  $form.MinimizeBox = $false
  $form.Size = New-Object System.Drawing.Size(460, 400)

  function Add-Row {
    param($Label, $Control, $Y)
    $lbl = New-Object System.Windows.Forms.Label
    $lbl.Text = $Label
    $lbl.Location = New-Object System.Drawing.Point(15, ($Y + 4))
    $lbl.Size = New-Object System.Drawing.Size(125, 20)
    $form.Controls.Add($lbl)
    $Control.Location = New-Object System.Drawing.Point(150, $Y)
    $Control.Size = New-Object System.Drawing.Size(280, 22)
    $form.Controls.Add($Control)
  }

  $cmbBrand = New-Object System.Windows.Forms.ComboBox
  $cmbBrand.DropDownStyle = 'DropDownList'
  [void]$cmbBrand.Items.AddRange($KnownBrands)
  $cmbBrand.SelectedItem = if ($isEdit) { $Device.brand } else { 'zkteco' }
  Add-Row 'Brand' $cmbBrand 20

  $txtSerial = New-Object System.Windows.Forms.TextBox
  if ($isEdit) { $txtSerial.Text = $Device.serial }
  Add-Row 'Serial number' $txtSerial 55

  $txtSecret = New-Object System.Windows.Forms.TextBox
  $txtSecret.UseSystemPasswordChar = $true
  if ($isEdit) { $txtSecret.Text = $Device.secret }
  Add-Row 'Cloud secret' $txtSecret 90

  $chkShowSecret = New-Object System.Windows.Forms.CheckBox
  $chkShowSecret.Text = 'Show'
  $chkShowSecret.Location = New-Object System.Drawing.Point(150, 115)
  $chkShowSecret.Size = New-Object System.Drawing.Size(60, 18)
  $chkShowSecret.Add_CheckedChanged({ $txtSecret.UseSystemPasswordChar = -not $chkShowSecret.Checked })
  $form.Controls.Add($chkShowSecret)

  $txtHost = New-Object System.Windows.Forms.TextBox
  if ($isEdit) { $txtHost.Text = $Device.host }
  Add-Row 'Device IP / hostname' $txtHost 145

  $numPort = New-Object System.Windows.Forms.NumericUpDown
  $numPort.Minimum = 1; $numPort.Maximum = 65535
  $numPort.Value = if ($isEdit) { [int]$Device.port } else { 80 }
  Add-Row 'Port' $numPort 180

  $txtUser = New-Object System.Windows.Forms.TextBox
  $txtUser.Text = if ($isEdit -and $Device.username) { $Device.username } else { 'admin' }
  Add-Row 'Admin username (optional)' $txtUser 215

  $txtPwd = New-Object System.Windows.Forms.TextBox
  $txtPwd.UseSystemPasswordChar = $true
  if ($isEdit) { $txtPwd.Text = $Device.password }
  Add-Row 'Admin password (optional)' $txtPwd 250

  $btnOk = New-Object System.Windows.Forms.Button
  $btnOk.Text = if ($isEdit) { 'Save' } else { 'Add device' }
  $btnOk.Location = New-Object System.Drawing.Point(265, 315)
  $btnOk.Size = New-Object System.Drawing.Size(110, 28)
  $btnOk.DialogResult = 'OK'
  $form.Controls.Add($btnOk)

  $btnCancel = New-Object System.Windows.Forms.Button
  $btnCancel.Text = 'Cancel'
  $btnCancel.Location = New-Object System.Drawing.Point(380, 315)
  $btnCancel.Size = New-Object System.Drawing.Size(60, 28)
  $btnCancel.DialogResult = 'Cancel'
  $form.Controls.Add($btnCancel)

  $form.AcceptButton = $btnOk
  $form.CancelButton = $btnCancel

  while ($true) {
    $r = $form.ShowDialog()
    if ($r -ne 'OK') { return $null }
    $err = @()
    if (-not $txtSerial.Text.Trim()) { $err += 'Serial number is required.' }
    if (-not $txtSecret.Text.Trim()) { $err += 'Cloud secret is required.' }
    if (-not $txtHost.Text.Trim())   { $err += 'Device IP / hostname is required.' }
    if ($err.Count -gt 0) {
      [System.Windows.Forms.MessageBox]::Show(($err -join "`n"), 'Missing fields',
        'OK','Warning') | Out-Null
      continue
    }
    return [pscustomobject]@{
      brand    = $cmbBrand.SelectedItem
      serial   = $txtSerial.Text.Trim()
      secret   = $txtSecret.Text.Trim()
      host     = $txtHost.Text.Trim()
      port     = [int]$numPort.Value
      username = $txtUser.Text.Trim()
      password = $txtPwd.Text
    }
  }
}

# ---------------------------------------------------------------------
#  Main wizard window.
# ---------------------------------------------------------------------
$main = New-Object System.Windows.Forms.Form
$main.Text = 'Fitro360 Relay Agent - Setup'
$main.StartPosition = 'CenterScreen'
$main.FormBorderStyle = 'FixedDialog'
$main.MaximizeBox = $false
$main.Size = New-Object System.Drawing.Size(680, 560)
# Force the window to the foreground when it appears. The parent
# powershell.exe is launched with -WindowStyle Hidden, so otherwise
# the form can open behind whatever the user has focused.
$main.TopMost = $true
$main.Add_Shown({
  $main.Activate()
  $main.TopMost = $false
})

$header = New-Object System.Windows.Forms.Label
$header.Text = 'Connect this PC to your Fitro360 cloud account'
$header.Font = New-Object System.Drawing.Font('Segoe UI', 12, [System.Drawing.FontStyle]::Bold)
$header.Location = New-Object System.Drawing.Point(20, 15)
$header.Size = New-Object System.Drawing.Size(640, 25)
$main.Controls.Add($header)

$sub = New-Object System.Windows.Forms.Label
$sub.Text = 'The relay will run as a Windows service in the background and forward access events to the cloud.'
$sub.ForeColor = [System.Drawing.Color]::DimGray
$sub.Location = New-Object System.Drawing.Point(20, 42)
$sub.Size = New-Object System.Drawing.Size(640, 35)
$main.Controls.Add($sub)

# Cloud URL row
$lblCloud = New-Object System.Windows.Forms.Label
$lblCloud.Text = 'Cloud URL'
$lblCloud.Location = New-Object System.Drawing.Point(20, 90)
$lblCloud.Size = New-Object System.Drawing.Size(120, 20)
$main.Controls.Add($lblCloud)

$txtCloud = New-Object System.Windows.Forms.TextBox
$txtCloud.Text = if ($existing -and $existing.cloudUrl) { $existing.cloudUrl } else { $DefaultCloudUrl }
$txtCloud.Location = New-Object System.Drawing.Point(150, 88)
$txtCloud.Size = New-Object System.Drawing.Size(490, 22)
$main.Controls.Add($txtCloud)

# Poll interval
$lblPoll = New-Object System.Windows.Forms.Label
$lblPoll.Text = 'Poll every (sec)'
$lblPoll.Location = New-Object System.Drawing.Point(20, 125)
$lblPoll.Size = New-Object System.Drawing.Size(120, 20)
$main.Controls.Add($lblPoll)

$numPoll = New-Object System.Windows.Forms.NumericUpDown
$numPoll.Minimum = 1; $numPoll.Maximum = 300
$numPoll.Value = if ($existing -and $existing.pollIntervalMs) {
  [Math]::Max(1, [int]([decimal]$existing.pollIntervalMs / 1000))
} else { 5 }
$numPoll.Location = New-Object System.Drawing.Point(150, 123)
$numPoll.Size = New-Object System.Drawing.Size(80, 22)
$main.Controls.Add($numPoll)

# Log level
$lblLog = New-Object System.Windows.Forms.Label
$lblLog.Text = 'Log level'
$lblLog.Location = New-Object System.Drawing.Point(260, 125)
$lblLog.Size = New-Object System.Drawing.Size(70, 20)
$main.Controls.Add($lblLog)

$cmbLog = New-Object System.Windows.Forms.ComboBox
$cmbLog.DropDownStyle = 'DropDownList'
[void]$cmbLog.Items.AddRange(@('debug','info','warn','error'))
$cmbLog.SelectedItem = if ($existing -and $existing.logLevel) { $existing.logLevel } else { 'info' }
$cmbLog.Location = New-Object System.Drawing.Point(330, 123)
$cmbLog.Size = New-Object System.Drawing.Size(120, 22)
$main.Controls.Add($cmbLog)

# Devices section
$lblDev = New-Object System.Windows.Forms.Label
$lblDev.Text = 'Biometric devices'
$lblDev.Font = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
$lblDev.Location = New-Object System.Drawing.Point(20, 165)
$lblDev.Size = New-Object System.Drawing.Size(300, 22)
$main.Controls.Add($lblDev)

$grid = New-Object System.Windows.Forms.DataGridView
$grid.Location = New-Object System.Drawing.Point(20, 195)
$grid.Size = New-Object System.Drawing.Size(620, 230)
$grid.AllowUserToAddRows = $false
$grid.AllowUserToDeleteRows = $false
$grid.ReadOnly = $true
$grid.SelectionMode = 'FullRowSelect'
$grid.MultiSelect = $false
$grid.RowHeadersVisible = $false
$grid.AutoSizeColumnsMode = 'Fill'
[void]$grid.Columns.Add('brand','Brand')
[void]$grid.Columns.Add('serial','Serial')
[void]$grid.Columns.Add('host','Host')
[void]$grid.Columns.Add('port','Port')
$grid.Columns['port'].FillWeight = 30
$main.Controls.Add($grid)

function Refresh-Grid {
  $grid.Rows.Clear()
  foreach ($d in $devices) {
    [void]$grid.Rows.Add($d.brand.ToUpper(), $d.serial, $d.host, $d.port)
  }
}
Refresh-Grid

$btnAdd = New-Object System.Windows.Forms.Button
$btnAdd.Text = '+ Add device'
$btnAdd.Location = New-Object System.Drawing.Point(20, 435)
$btnAdd.Size = New-Object System.Drawing.Size(110, 28)
$btnAdd.Add_Click({
  $d = Show-DeviceDialog -Device $null
  if ($d) {
    if ($devices | Where-Object { $_.serial -eq $d.serial }) {
      [System.Windows.Forms.MessageBox]::Show(
        "A device with serial '$($d.serial)' already exists.",
        'Duplicate serial','OK','Warning') | Out-Null
      return
    }
    [void]$devices.Add($d)
    Refresh-Grid
  }
})
$main.Controls.Add($btnAdd)

$btnEdit = New-Object System.Windows.Forms.Button
$btnEdit.Text = 'Edit'
$btnEdit.Location = New-Object System.Drawing.Point(140, 435)
$btnEdit.Size = New-Object System.Drawing.Size(80, 28)
$btnEdit.Add_Click({
  if ($grid.SelectedRows.Count -eq 0) { return }
  $idx = $grid.SelectedRows[0].Index
  $updated = Show-DeviceDialog -Device $devices[$idx]
  if ($updated) {
    $devices[$idx] = $updated
    Refresh-Grid
  }
})
$main.Controls.Add($btnEdit)

$btnRemove = New-Object System.Windows.Forms.Button
$btnRemove.Text = 'Remove'
$btnRemove.Location = New-Object System.Drawing.Point(230, 435)
$btnRemove.Size = New-Object System.Drawing.Size(80, 28)
$btnRemove.Add_Click({
  if ($grid.SelectedRows.Count -eq 0) { return }
  $idx = $grid.SelectedRows[0].Index
  $r = [System.Windows.Forms.MessageBox]::Show(
    "Remove device '$($devices[$idx].serial)'?",
    'Confirm', 'YesNo','Question')
  if ($r -eq 'Yes') { $devices.RemoveAt($idx); Refresh-Grid }
})
$main.Controls.Add($btnRemove)

# Action buttons
$btnSave = New-Object System.Windows.Forms.Button
$btnSave.Text = 'Save && install'
$btnSave.BackColor = [System.Drawing.Color]::FromArgb(30, 64, 175)
$btnSave.ForeColor = [System.Drawing.Color]::White
$btnSave.FlatStyle = 'Flat'
$btnSave.Location = New-Object System.Drawing.Point(450, 480)
$btnSave.Size = New-Object System.Drawing.Size(120, 32)
$main.Controls.Add($btnSave)

$btnCancel = New-Object System.Windows.Forms.Button
$btnCancel.Text = 'Cancel'
$btnCancel.Location = New-Object System.Drawing.Point(580, 480)
$btnCancel.Size = New-Object System.Drawing.Size(60, 32)
$btnCancel.DialogResult = 'Cancel'
$main.Controls.Add($btnCancel)
$main.CancelButton = $btnCancel

$saved = $false
$btnSave.Add_Click({
  $url = $txtCloud.Text.Trim()
  if (-not ($url -match '^https?://')) {
    [System.Windows.Forms.MessageBox]::Show(
      'Cloud URL must start with http:// or https://',
      'Invalid URL','OK','Warning') | Out-Null
    return
  }
  $allowInsecure = $false
  if ($url -match '^http://') {
    $r = [System.Windows.Forms.MessageBox]::Show(
      "Plain HTTP is not encrypted. Use it only for testing on a trusted LAN.`n`nContinue with HTTP?",
      'Insecure connection','YesNo','Warning')
    if ($r -ne 'Yes') { return }
    $allowInsecure = $true
  }
  if ($devices.Count -eq 0) {
    [System.Windows.Forms.MessageBox]::Show(
      'Add at least one biometric device before saving.',
      'No devices','OK','Warning') | Out-Null
    return
  }

  # Build the JSON payload exactly the way the CLI wizard does, so
  # both code paths produce a config the agent accepts.
  $cfgDevices = @()
  foreach ($d in $devices) {
    $obj = [ordered]@{
      brand  = $d.brand
      serial = $d.serial
      secret = $d.secret
      host   = $d.host
      port   = [int]$d.port
    }
    if ($d.username) { $obj.username = $d.username }
    if ($d.password) { $obj.password = $d.password }
    $cfgDevices += [pscustomobject]$obj
  }
  $cfg = [ordered]@{
    cloudUrl       = $url
    pollIntervalMs = [int]$numPoll.Value * 1000
    logLevel       = $cmbLog.SelectedItem
    devices        = $cfgDevices
  }
  if ($allowInsecure) { $cfg.allowInsecureCloudUrl = $true }

  try {
    $dir = Split-Path -Parent $ConfigPath
    if (-not (Test-Path -LiteralPath $dir)) {
      New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    # Lock down the parent directory BEFORE writing the secret-bearing
    # file. Mirrors what the Node-side lockdownConfigDir() does so the
    # secrets are never on disk under inherited ACLs, even briefly.
    & icacls.exe $dir '/inheritance:r' 2>$null | Out-Null
    & icacls.exe $dir '/grant:r' '*S-1-5-32-544:(OI)(CI)F' 2>$null | Out-Null
    & icacls.exe $dir '/grant:r' '*S-1-5-18:(OI)(CI)F'    2>$null | Out-Null

    # Write BOM-less UTF-8 - Windows PowerShell 5.1's `Set-Content -Encoding UTF8`
    # prepends a BOM, which makes Node's JSON.parse() throw when the agent
    # reads the file. Use .NET directly to guarantee no BOM.
    $json = $cfg | ConvertTo-Json -Depth 5
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($ConfigPath, $json, $utf8NoBom)

    & icacls.exe $ConfigPath '/inheritance:r' 2>$null | Out-Null
    & icacls.exe $ConfigPath '/grant:r' '*S-1-5-32-544:F' 2>$null | Out-Null
    & icacls.exe $ConfigPath '/grant:r' '*S-1-5-18:F'    2>$null | Out-Null

    $script:saved = $true
    $main.DialogResult = 'OK'
    $main.Close()
  } catch {
    [System.Windows.Forms.MessageBox]::Show(
      "Could not save the config file:`n$($_.Exception.Message)",
      'Save failed','OK','Error') | Out-Null
  }
})

$null = $main.ShowDialog()
if ($saved) { exit 0 } else { exit 2 }
