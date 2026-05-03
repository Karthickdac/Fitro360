@echo off
REM Fitro360 Relay Agent — uninstaller (removes the boot service only;
REM your config.json under %ProgramData%\Fitro360 is left in place).

setlocal
cd /d "%~dp0"

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Requesting administrator privileges...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

set "EXE=%~dp0fitro360-relay.exe"
if not exist "%EXE%" set "EXE=%~dp0..\fitro360-relay.exe"
if not exist "%EXE%" (
  echo ERROR: fitro360-relay.exe not found next to this uninstaller.
  pause
  exit /b 1
)

"%EXE%" --uninstall-service
echo.
echo Done. Config files under %%ProgramData%%\Fitro360 were preserved.
echo Delete that folder manually if you also want to remove your secrets.
pause
endlocal
