# Fitro360 relay agent — Windows installer.
# Run from an elevated PowerShell prompt:
#   powershell -ExecutionPolicy Bypass -File .\install-windows.ps1
# Requires Node.js 18+ already installed (https://nodejs.org/).

$ErrorActionPreference = "Stop"

if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Error "Please run this installer from an elevated PowerShell prompt."
  exit 1
}

$NodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $NodeCmd) {
  Write-Error "Node.js 18+ is required. Install from https://nodejs.org/ and re-run."
  exit 1
}
# Enforce Node >= 18 (the agent relies on the global `fetch` introduced in 18).
$NodeVersion = (& node -p "process.versions.node").Trim()
$NodeMajor = [int]($NodeVersion.Split(".")[0])
if ($NodeMajor -lt 18) {
  Write-Error "Detected Node.js v$NodeVersion. The relay agent requires Node.js 18 or newer."
  exit 1
}
# Resolve the absolute path so the SYSTEM-context Scheduled Task does
# not depend on the system PATH (which often does not include the per-user
# Node install location).
$NodeExe = $NodeCmd.Source
if (-not (Test-Path $NodeExe)) {
  Write-Error "Could not resolve absolute path for node.exe ('$NodeExe')."
  exit 1
}
Write-Host "Using node: $NodeExe"

$Src = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$InstallDir = "C:\Program Files\Fitro360Relay"
$ConfigDir  = "C:\ProgramData\Fitro360"
$LogDir     = Join-Path $ConfigDir "logs"

New-Item -ItemType Directory -Force -Path $InstallDir, $ConfigDir, $LogDir | Out-Null
Copy-Item -Recurse -Force "$Src\src" $InstallDir
Copy-Item -Force "$Src\package.json" $InstallDir
Copy-Item -Force "$Src\config.example.json" $InstallDir

$Config = Join-Path $ConfigDir "config.json"
if (-not (Test-Path $Config)) {
  Copy-Item -Force "$Src\config.example.json" $Config
  Write-Host ">>> Edit $Config with your cloudUrl, device serial, and secret." -ForegroundColor Yellow
}

# Harden ACLs on the config file: it holds the per-device cloud secret,
# so only Administrators and SYSTEM should be able to read or change it.
# Disable inheritance, then explicitly grant only those two principals.
$Acl = Get-Acl $Config
$Acl.SetAccessRuleProtection($true, $false)
$Acl.Access | ForEach-Object { [void]$Acl.RemoveAccessRule($_) }
foreach ($p in @("BUILTIN\Administrators", "NT AUTHORITY\SYSTEM")) {
  $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
    $p, "FullControl", "Allow")
  $Acl.AddAccessRule($rule)
}
Set-Acl -Path $Config -AclObject $Acl
Write-Host "Locked down ACL on $Config (Administrators + SYSTEM only)."

# Register a Scheduled Task to run on boot as SYSTEM. (For a true
# Windows service, install nssm and run `nssm install Fitro360Relay`
# pointing at node.exe with the same arguments.)
$Action = New-ScheduledTaskAction -Execute $NodeExe `
  -Argument "`"$InstallDir\src\index.js`" --config `"$Config`""
$Trigger = New-ScheduledTaskTrigger -AtStartup
$Settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest

Register-ScheduledTask -TaskName "Fitro360Relay" -Action $Action -Trigger $Trigger `
  -Settings $Settings -Principal $Principal -Force | Out-Null

Start-ScheduledTask -TaskName "Fitro360Relay"

# Verify the task actually started — surface a clear error if it did not.
Start-Sleep -Seconds 2
$TaskInfo = Get-ScheduledTaskInfo -TaskName "Fitro360Relay"
$TaskState = (Get-ScheduledTask -TaskName "Fitro360Relay").State
Write-Host "Task state: $TaskState (last result: 0x$([Convert]::ToString($TaskInfo.LastTaskResult,16)))"
if ($TaskState -ne "Running" -and $TaskInfo.LastTaskResult -ne 0 -and $TaskInfo.LastTaskResult -ne 267009) {
  Write-Warning "The Fitro360Relay task did not enter the Running state. Inspect Task Scheduler -> Fitro360Relay -> History."
}

Write-Host ""
Write-Host "Installed. The Fitro360 relay is now running and will start on boot." -ForegroundColor Green
Write-Host "  Config: $Config"
Write-Host "  Logs:   Use Task Scheduler -> Fitro360Relay -> History, or run manually:" 
Write-Host "          node `"$InstallDir\src\index.js`" --config `"$Config`""
