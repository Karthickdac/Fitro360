Fitro360 Relay Agent — Windows
==============================

This release contains exactly three things you need to touch:

    Install.bat       ← double-click to install
    Uninstall.bat     ← double-click to remove
    README.txt        ← this file

Everything else (the .exe, the GUI scripts, the helper PowerShell
files) lives in the lib\ subfolder. You don't need to open it.

Install
-------

1. Double-click  Install.bat.
2. A small CMD window flashes for a fraction of a second, then a
   UAC prompt asks for administrator rights. Click Yes.
3. The graphical setup window opens. Fill in:
      - Cloud URL (e.g. https://app.fitro360.com)
      - Click "+ Add device" once per biometric reader
        (paste the Cloud secret from Fitro360 -> Devices)
4. Click  Save & install.
5. The wizard closes; the service is registered and started; the
   "Fitro360 Relay Manager" window opens so you can confirm it's
   running and watch the live log. A "Fitro360 Relay" shortcut is
   added to your Start Menu so you can re-open the manager later
   without touching this folder.

Open the manager later
----------------------

Press the Windows key, type "Fitro360", press Enter.

From the manager you can:
   - See live status (Running / Ready / Not installed)
   - Start / Stop / Restart the service
   - Browse configured devices
   - Tail the agent log (auto-refreshes every 5 sec)
   - Reconfigure (re-opens the setup window with your existing values)

Uninstall
---------

Double-click  Uninstall.bat  and approve UAC. Removes the service
and the Start Menu shortcut. Your config.json under
  C:\ProgramData\Fitro360
is preserved -- delete that folder by hand if you also want to wipe
stored device secrets.

If Windows blocks Install.bat
-----------------------------

If Windows SmartScreen shows "Windows protected your PC", click
"More info" -> "Run anyway".

If Smart App Control silently blocks the file, right-click
Install.bat -> Properties -> tick "Unblock" -> OK, and try again.

Power-user CLI flags
--------------------

The graphical tools call the same flags you can use directly from a
Command Prompt if you want to script things:

    lib\fitro360-relay.exe --setup              CLI text wizard
    lib\fitro360-relay.exe --install-service    register boot service
    lib\fitro360-relay.exe --uninstall-service  remove boot service
    lib\fitro360-relay.exe --start-service      start the service now
    lib\fitro360-relay.exe --stop-service       stop it
    lib\fitro360-relay.exe --service-status     show schtasks state
