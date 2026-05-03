@echo off
REM Power-user fallback — see install.bat.
cd /d "%~dp0"
if exist "Uninstall Fitro360 Relay.vbs" (
  cscript //nologo "%~dp0Uninstall Fitro360 Relay.vbs"
  exit /b
)
echo Uninstall Fitro360 Relay.vbs is missing from this folder.
pause
