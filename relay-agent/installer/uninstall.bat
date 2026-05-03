@echo off
REM Fitro360 Relay Agent — uninstaller. See install.bat header for
REM why we use -WorkingDirectory + a relative -File argument.
cd /d "%~dp0"
start "" /min powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Process powershell.exe -Verb RunAs -WindowStyle Hidden -WorkingDirectory '%~dp0' -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File','uninstall.ps1'"
exit /b
