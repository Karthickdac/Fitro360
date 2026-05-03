' Windowless launcher for the Fitro360 Relay Manager window.
' .ps1 files don't run when double-clicked (Windows opens them in
' Notepad), so this VBS shim is the way to launch the manager from
' a desktop shortcut or directly from the install folder.
Option Explicit

Dim fso, here, ps1, args, sh
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
ps1 = here & "\manager.ps1"

If Not fso.FileExists(ps1) Then
  MsgBox "manager.ps1 is missing from this folder.", vbCritical, "Fitro360 — manager"
  WScript.Quit 1
End If

args = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & ps1 & """"
Set sh = CreateObject("Shell.Application")
' Manager.ps1 self-elevates if needed, so we don't ask for elevation here.
sh.ShellExecute "powershell.exe", args, "", "open", 0
