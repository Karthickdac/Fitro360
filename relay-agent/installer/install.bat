@echo off
REM Power-user fallback. Most operators should double-click
REM "Install Fitro360 Relay.vbs" instead — it launches the GUI
REM installer without ever showing a CMD or PowerShell window.
REM
REM This file is preserved for ops teams that prefer to script
REM the install (e.g. via SCCM / GPO startup task).

cd /d "%~dp0"
if exist "Install Fitro360 Relay.vbs" (
  cscript //nologo "%~dp0Install Fitro360 Relay.vbs"
  exit /b
)
echo Install Fitro360 Relay.vbs is missing from this folder.
pause
