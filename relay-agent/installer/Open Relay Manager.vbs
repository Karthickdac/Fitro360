' Windowless launcher for manager.ps1. See Install Fitro360 Relay.vbs.
Option Explicit
Dim fso, here, args, sh
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
If Not fso.FileExists(here & "\manager.ps1") Then
  MsgBox "manager.ps1 is missing from this folder.", vbCritical, "Fitro360 — manager"
  WScript.Quit 1
End If
args = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -WorkingDirectory """ & here & """ -File ""manager.ps1"""
Set sh = CreateObject("Shell.Application")
sh.ShellExecute "powershell.exe", args, "", "open", 0
