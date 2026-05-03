@echo off
REM ─────────────────────────────────────────────────────────────────
REM  Fitro360 Relay Agent — installer entry point.
REM
REM  Double-click this file. The CMD window flashes for a fraction
REM  of a second, then everything from that point on is graphical:
REM  the UAC prompt, the setup wizard, and the manager window.
REM
REM  We use a .bat (not a .vbs) as the primary entry because Windows
REM  11 Smart App Control silently blocks unsigned VBScript files
REM  downloaded from the internet, while .bat files are universally
REM  allowed. A VBS launcher is still shipped alongside as an
REM  alternative — see "Install Fitro360 Relay.vbs".
REM ─────────────────────────────────────────────────────────────────

cd /d "%~dp0"
start "" /min powershell.exe -NoProfile -WindowStyle Hidden -Command ^
  "Start-Process powershell.exe -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File','%~dp0install.ps1' -Verb RunAs -WindowStyle Hidden"
exit /b
