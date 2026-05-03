' Windowless launcher for the uninstaller. See Install Fitro360 Relay.vbs.
Option Explicit

Dim fso, here, ps1, args, sh
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
ps1 = here & "\uninstall.ps1"

If Not fso.FileExists(ps1) Then
  MsgBox "uninstall.ps1 is missing from this folder.", vbCritical, "Fitro360 — uninstall error"
  WScript.Quit 1
End If

args = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & ps1 & """"
Set sh = CreateObject("Shell.Application")
sh.ShellExecute "powershell.exe", args, "", "runas", 0
