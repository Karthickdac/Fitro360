@echo off
REM ─────────────────────────────────────────────────────────────────
REM  Fitro360 Relay Agent — one-click Windows installer
REM
REM  Right-click this file and choose "Run as administrator".
REM  It will:
REM    1. Open a graphical setup window (no command prompt)
REM    2. Save your config to %ProgramData%\Fitro360\config.json
REM    3. Register the agent as a Windows boot service
REM    4. Open the manager window so you can see it running
REM ─────────────────────────────────────────────────────────────────

setlocal
cd /d "%~dp0"

REM Re-launch elevated if not already admin.
net session >nul 2>&1
if %errorlevel% neq 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

set "EXE=%~dp0fitro360-relay.exe"
if not exist "%EXE%" set "EXE=%~dp0..\fitro360-relay.exe"
if not exist "%EXE%" (
  powershell -NoProfile -Command "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('fitro360-relay.exe not found next to this installer. Please unzip the entire release folder to one location and try again.', 'Fitro360 — install error', 'OK', 'Error') | Out-Null"
  exit /b 1
)

set "GUI=%~dp0setup-gui.ps1"
if not exist "%GUI%" (
  powershell -NoProfile -Command "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('setup-gui.ps1 missing from the release folder.', 'Fitro360 — install error', 'OK', 'Error') | Out-Null"
  exit /b 1
)

REM 1. Show the WinForms setup wizard. Exit code 0 = saved, 2 = user cancelled.
powershell -NoProfile -ExecutionPolicy Bypass -File "%GUI%"
set "RC=%errorlevel%"
if "%RC%"=="2" (
  REM User cancelled — silent exit, no nag.
  exit /b 0
)
if not "%RC%"=="0" (
  powershell -NoProfile -Command "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('The setup wizard exited unexpectedly. Service was NOT installed.', 'Fitro360 — setup failed', 'OK', 'Error') | Out-Null"
  exit /b %RC%
)

REM 2. Register the boot service. The .exe handles its own elevation check.
"%EXE%" --install-service >"%TEMP%\fitro360-install.log" 2>&1
if %errorlevel% neq 0 (
  powershell -NoProfile -Command "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('Service registration failed. See %TEMP%\fitro360-install.log for details.', 'Fitro360 — install failed', 'OK', 'Error') | Out-Null"
  exit /b %errorlevel%
)

REM 3. Pop open the manager window so the operator sees it's running.
set "MGR=%~dp0manager.ps1"
if exist "%MGR%" (
  start "" powershell -NoProfile -ExecutionPolicy Bypass -File "%MGR%"
) else (
  powershell -NoProfile -Command "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('Fitro360 Relay installed and started.\n\nConfig: %ProgramData%\Fitro360\config.json\nService: Fitro360Relay (auto-starts on boot)', 'Fitro360 — installed', 'OK', 'Information') | Out-Null"
)

endlocal
