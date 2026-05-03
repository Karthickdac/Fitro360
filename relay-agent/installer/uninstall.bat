@echo off
REM Fitro360 Relay Agent — uninstaller entry point. See install.bat
REM for why this is a .bat and not a .vbs.
cd /d "%~dp0"
start "" /min powershell.exe -NoProfile -WindowStyle Hidden -Command ^
  "Start-Process powershell.exe -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File','%~dp0uninstall.ps1' -Verb RunAs -WindowStyle Hidden"
exit /b
