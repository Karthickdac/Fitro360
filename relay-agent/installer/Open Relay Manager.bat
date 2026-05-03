@echo off
REM Opens the Fitro360 Relay Manager window. .bat is used (not .vbs)
REM because Smart App Control blocks unsigned VBS downloads.
cd /d "%~dp0"
start "" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0manager.ps1"
exit /b
