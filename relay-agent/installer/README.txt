Fitro360 Relay Agent — Windows
==============================

Self-contained installer for the gym PC. No Node.js, no Python, no
typing in a command prompt. The whole experience is graphical.

Files in this folder:

    install.bat                     ← double-click to install (primary)
    uninstall.bat                   ← double-click to remove
    Open Relay Manager.bat          ← double-click any time to manage
    fitro360-relay.exe              ← the agent itself (single binary)
    setup-gui.ps1 / manager.ps1     ← the WinForms windows (called by .bat)
    install.ps1 / uninstall.ps1     ← orchestrators (called by .bat)
    README.txt                      ← this file

    Install Fitro360 Relay.vbs      ← .vbs alternatives — see "Smart App
    Uninstall Fitro360 Relay.vbs      Control" note below before using
    Open Relay Manager.vbs

Quick start
-----------

1. Double-click  install.bat.
2. A small CMD window flashes for a fraction of a second, then a UAC
   prompt asks for administrator rights. Click Yes.
3. The graphical setup window opens. Fill in:
      - Cloud URL (e.g. https://app.fitro360.com)
      - Click "+ Add device" once per biometric reader
        (paste the Cloud secret from Fitro360 -> Devices)
4. Click  Save & install.
5. The wizard closes; the service is registered and started; the
   "Fitro360 Relay Manager" window opens so you can confirm it's
   running and watch the live log.

After that brief CMD flash, no other console window appears.

Manage it later
---------------

Double-click  "Open Relay Manager.bat"  any time to open the manager.
From there you can:
   - See live status (Running / Ready / Not installed)
   - Start / Stop / Restart the service
   - Browse configured devices
   - Tail the agent log (auto-refreshes every 5 sec)
   - Reconfigure (re-opens the setup window with your existing values)
   - Open the config folder

Removing it
-----------

Double-click  uninstall.bat  and approve UAC.
Your config.json under  C:\ProgramData\Fitro360  is preserved -- delete
that folder by hand if you also want to wipe stored device secrets.

Smart App Control / SmartScreen warnings
-----------------------------------------

Windows 11 Smart App Control silently blocks unsigned VBScript files
downloaded from the internet. That's why the primary entry points in
this release are .bat files (universally allowed), not .vbs.

If you prefer the truly windowless .vbs launchers ("Install Fitro360
Relay.vbs" etc.) and Windows refuses to run them:

   1. Right-click the .vbs file -> Properties -> tick "Unblock" -> OK.
      This removes the "Mark of the Web" applied to every file
      extracted from a downloaded zip.
   2. If Smart App Control still blocks it, you'll need to either use
      the .bat entry instead, or temporarily turn off Smart App
      Control (Windows Security -> App & browser control -> Smart App
      Control settings).

If SmartScreen ("Windows protected your PC") shows on the .bat, click
"More info" -> "Run anyway".

Power-user CLI flags
--------------------

The graphical tools call the same flags you can use directly from a
Command Prompt if you want to script things:

    fitro360-relay.exe --setup              CLI text wizard
    fitro360-relay.exe --install-service    register boot service
    fitro360-relay.exe --uninstall-service  remove boot service
    fitro360-relay.exe --start-service      start the service now
    fitro360-relay.exe --stop-service       stop it
    fitro360-relay.exe --service-status     show schtasks state
