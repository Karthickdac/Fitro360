@echo off
REM ─────────────────────────────────────────────────────────────────
REM  Fitro360 Relay Agent — installer entry point.
REM
REM  Double-click this file. The CMD window flashes for a fraction
REM  of a second, then everything is graphical: UAC prompt, setup
REM  wizard, manager window.
REM
REM  We use -WorkingDirectory + a relative -File argument because the
REM  install folder may sit under a path with spaces (e.g.
REM  "C:\Users\John Smith\Downloads\...") and Start-Process does not
REM  quote ArgumentList elements automatically.
REM ─────────────────────────────────────────────────────────────────

cd /d "%~dp0"
start "" /min powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Process powershell.exe -Verb RunAs -WindowStyle Hidden -WorkingDirectory '%~dp0' -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File','install.ps1'"
exit /b
