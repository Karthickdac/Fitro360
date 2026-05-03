@echo off
REM ─────────────────────────────────────────────────────────────────
REM  Fitro360 Relay Agent — installer.
REM  Right-click -> Run as administrator, OR just double-click and
REM  approve the UAC prompt. Tracing is written to
REM      %TEMP%\fitro360-trace.log
REM  so any silent failure is diagnosable.
REM ─────────────────────────────────────────────────────────────────

cd /d "%~dp0"
set "TRACE=%TEMP%\fitro360-trace.log"
echo [%DATE% %TIME%] Install.bat: started, cwd=%CD% >> "%TRACE%"

if not exist "%~dp0lib\install.ps1" (
  echo [%DATE% %TIME%] Install.bat: lib\install.ps1 MISSING >> "%TRACE%"
  echo ERROR: lib\install.ps1 missing. Re-extract the entire release zip.
  pause
  exit /b 1
)

REM Are we already elevated? `net session` returns 0 only when admin.
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo [%DATE% %TIME%] Install.bat: not elevated, self-elevating >> "%TRACE%"
  powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo [%DATE% %TIME%] Install.bat: elevated, launching install.ps1 >> "%TRACE%"
start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0lib\install.ps1"
echo [%DATE% %TIME%] Install.bat: spawned install.ps1, exiting >> "%TRACE%"
exit /b
