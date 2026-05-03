@echo off
REM Fitro360 Relay Agent — uninstaller. Removes the boot service and
REM the Start Menu shortcut. Your config.json is preserved.
cd /d "%~dp0"
if not exist "%~dp0lib\uninstall.ps1" (
  echo ERROR: lib\uninstall.ps1 missing. Re-extract the entire release zip.
  pause
  exit /b 1
)
start "" /min powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Process powershell.exe -Verb RunAs -WindowStyle Hidden -WorkingDirectory '%~dp0lib' -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File','uninstall.ps1'"
exit /b
