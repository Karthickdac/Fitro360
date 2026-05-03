@echo off
REM ─────────────────────────────────────────────────────────────────
REM  Fitro360 Relay Agent — one-click Windows installer
REM
REM  Right-click this file and choose "Run as administrator".
REM  It will:
REM    1. Walk you through a setup wizard to create config.json
REM    2. Register the agent as a Windows boot service
REM    3. Start the service immediately
REM ─────────────────────────────────────────────────────────────────

setlocal
cd /d "%~dp0"

REM Re-launch elevated if not already admin.
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Requesting administrator privileges...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

REM Resolve the .exe — try same folder first, then ..\fitro360-relay.exe
set "EXE=%~dp0fitro360-relay.exe"
if not exist "%EXE%" set "EXE=%~dp0..\fitro360-relay.exe"
if not exist "%EXE%" (
  echo ERROR: fitro360-relay.exe not found next to this installer.
  echo        Please unzip the entire release folder to one location and try again.
  pause
  exit /b 1
)

echo.
echo ============================================
echo   Fitro360 Relay Agent — Installer
echo ============================================
echo Using: %EXE%
echo.

"%EXE%" --setup
if %errorlevel% neq 0 (
  echo.
  echo Setup wizard cancelled or failed. Service NOT installed.
  pause
  exit /b %errorlevel%
)

"%EXE%" --install-service
if %errorlevel% neq 0 (
  echo.
  echo Service registration failed.
  pause
  exit /b %errorlevel%
)

echo.
echo ============================================
echo   Installation complete.
echo ============================================
echo Config:   %ProgramData%\Fitro360\config.json
echo Service:  Fitro360Relay  (auto-starts on boot, running now)
echo.
echo To check status later, open a Command Prompt and run:
echo   schtasks /Query /TN Fitro360Relay /V /FO LIST
echo.
pause
endlocal
