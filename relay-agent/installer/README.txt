Fitro360 Relay Agent — Windows
==============================

Everything in this folder is a self-contained installer for the gym PC.
Nothing else is required — no Node.js, no Python, no command prompt.

    fitro360-relay.exe   ← the agent itself (single file)
    install.bat          ← one-click installer (right-click → Run as administrator)
    uninstall.bat        ← removes the boot service
    setup-gui.ps1        ← graphical setup wizard (called by install.bat)
    manager.ps1          ← graphical service manager / log viewer
    README.txt           ← this file

Quick start
-----------

1. Right-click  install.bat  →  "Run as administrator".

2. A setup window opens. Fill in:
      • Cloud URL                  (e.g. https://app.fitro360.com)
      • Poll interval / log level
      • Click "+ Add device" for each biometric reader
        (paste the Cloud secret from Fitro360 → Devices)

3. Click  Save & install.
   The window closes; the service is registered and started; the
   "Fitro360 Relay Manager" window opens so you can confirm it is
   running and see the latest log lines.

That's it. The agent restarts automatically on every boot and pulls
queued door-open / enrol / delete commands from the cloud.

Manage it later
---------------

Double-click  manager.ps1  any time to open the manager window. From
there you can:
   • See live status (Running / Ready / Not installed)
   • Start / Stop / Restart the service
   • Browse configured devices
   • Tail the agent log (auto-refreshes every 5 sec)
   • Reconfigure (re-opens the setup window with your existing values)
   • Open the config folder

Removing it
-----------

Right-click  uninstall.bat  →  "Run as administrator".
The boot service is removed. Your config.json under
C:\ProgramData\Fitro360 is preserved — delete that folder by hand if
you also want to wipe your stored device secrets.

Power-user CLI flags
--------------------

The graphical tools call the same flags you can use directly from a
Command Prompt if you ever need to script things:

    fitro360-relay.exe --setup              CLI text wizard
    fitro360-relay.exe --install-service    register boot service
    fitro360-relay.exe --uninstall-service  remove boot service
    fitro360-relay.exe --start-service      start the service now
    fitro360-relay.exe --stop-service       stop it
    fitro360-relay.exe --service-status     show schtasks state
