@echo off
REM Fitro360 Relay Agent uninstaller. Tracing -> %TEMP%\fitro360-trace.log
cd /d "%~dp0"
set "TRACE=%TEMP%\fitro360-trace.log"
echo [%DATE% %TIME%] Uninstall.bat: started >> "%TRACE%"

if not exist "%~dp0lib\uninstall.ps1" (
  echo ERROR: lib\uninstall.ps1 missing. Re-extract the release zip.
  pause
  exit /b 1
)

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo [%DATE% %TIME%] Uninstall.bat: not elevated, self-elevating >> "%TRACE%"
  powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo [%DATE% %TIME%] Uninstall.bat: elevated, launching uninstall.ps1 >> "%TRACE%"
start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0lib\uninstall.ps1"
exit /b
