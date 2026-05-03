Fitro360 Relay Agent — Windows
==============================

Self-contained installer for the gym PC. No Node.js, no Python, and
no command prompt — the entire flow is graphical.

Files in this folder:

    Install Fitro360 Relay.vbs      ← double-click to install (GUI)
    Uninstall Fitro360 Relay.vbs    ← double-click to remove
    Open Relay Manager.vbs          ← double-click any time to manage
    fitro360-relay.exe              ← the agent itself (single binary)
    setup-gui.ps1 / manager.ps1     ← the WinForms windows
    install.ps1 / uninstall.ps1     ← orchestrators (called by the .vbs)
    install.bat / uninstall.bat     ← power-user CLI fallbacks
    README.txt                      ← this file

Quick start
-----------

1. Double-click  "Install Fitro360 Relay.vbs".
2. Approve the User Account Control (UAC) prompt.
3. The graphical setup window opens. Fill in:
      - Cloud URL (e.g. https://app.fitro360.com)
      - Click "+ Add device" once per biometric reader
        (paste the Cloud secret from Fitro360 -> Devices)
4. Click  Save & install.
5. The wizard closes; the service is registered and started; the
   "Fitro360 Relay Manager" window opens so you can confirm it's
   running and watch the live log.

You will NOT see any black command-prompt window at any point.

Manage it later
---------------

Double-click  "Open Relay Manager.vbs"  any time to open the manager.
From there you can:
   - See live status (Running / Ready / Not installed)
   - Start / Stop / Restart the service
   - Browse configured devices
   - Tail the agent log (auto-refreshes every 5 sec)
   - Reconfigure (re-opens the setup window with your existing values)
   - Open the config folder

Removing it
-----------

Double-click  "Uninstall Fitro360 Relay.vbs"  and approve UAC.
Your config.json under  C:\ProgramData\Fitro360  is preserved -- delete
that folder by hand if you also want to wipe stored device secrets.

Troubleshooting
---------------

If a downloaded .vbs / .ps1 file refuses to run because of "Mark of the
Web", right-click it -> Properties -> tick "Unblock" -> OK, and try
again. (Windows applies that flag to every file that came out of a
downloaded zip.)

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
