Fitro360 Relay Agent — Windows
==============================

This folder contains everything you need to run the relay on a gym PC:

    fitro360-relay.exe   ← the agent itself (single file, no Node install needed)
    install.bat          ← one-click installer (right-click → Run as administrator)
    uninstall.bat        ← removes the boot service
    README.txt           ← this file

Quick start
-----------

1. Right-click  install.bat  →  "Run as administrator".
2. Answer the wizard prompts:
      • Cloud URL                  (e.g. https://app.fitro360.com)
      • Brand, serial, secret      (copy from Fitro360 → Devices)
      • Device LAN IP / port       (the reader on your gym network)
      • Device admin user/password (only needed for some brands)
3. The wizard saves the config to:
      C:\ProgramData\Fitro360\config.json
4. The installer registers the agent as a Windows boot service
   (Task Scheduler task named "Fitro360Relay") and starts it.

That's it. The agent will keep running, restart on reboot, and pick up
queued door-open / enrol / delete commands from the cloud.

Re-running the wizard later
---------------------------
Open Command Prompt and run:

    "C:\Path\To\fitro360-relay.exe" --setup

To add a new device, choose "Keep existing devices" when asked, then
answer "yes" when prompted to add another biometric device.

Verifying the service
---------------------
    schtasks /Query /TN Fitro360Relay /V /FO LIST

Removing it
-----------
Right-click  uninstall.bat  →  "Run as administrator".
Your config.json is preserved (delete C:\ProgramData\Fitro360 by hand
if you also want to wipe your device secrets).
