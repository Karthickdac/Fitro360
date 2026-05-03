@echo off
REM Opens the Fitro360 Relay Manager window. -WorkingDirectory +
REM relative -File handles install folders that contain spaces.
cd /d "%~dp0"
start "" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -WorkingDirectory "%~dp0" -File "manager.ps1"
exit /b
