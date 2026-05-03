@echo off
REM ─────────────────────────────────────────────────────────────────
REM  Fitro360 Relay Agent — installer.
REM
REM  Double-click this file. The CMD window flashes for a fraction
REM  of a second, then everything is graphical: UAC prompt, setup
REM  wizard, manager window. A "Fitro360 Relay" Start Menu shortcut
REM  is created so you can re-open the manager later without coming
REM  back to this folder.
REM ─────────────────────────────────────────────────────────────────

cd /d "%~dp0"
if not exist "%~dp0lib\install.ps1" (
  echo ERROR: lib\install.ps1 missing. Re-extract the entire release zip.
  pause
  exit /b 1
)
start "" /min powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Process powershell.exe -Verb RunAs -WindowStyle Hidden -WorkingDirectory '%~dp0lib' -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File','install.ps1'"
exit /b
