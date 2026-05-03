' Windowless uninstaller launcher. See Install Fitro360 Relay.vbs.
Option Explicit
Dim fso, here, args, sh
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
If Not fso.FileExists(here & "\uninstall.ps1") Then
  MsgBox "uninstall.ps1 is missing from this folder.", vbCritical, "Fitro360 — uninstall"
  WScript.Quit 1
End If
args = "-NoProfile -WindowStyle Hidden -Command ""Start-Process powershell.exe -Verb RunAs -WindowStyle Hidden -WorkingDirectory '" & here & "' -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File','uninstall.ps1'"""
Set sh = CreateObject("Shell.Application")
sh.ShellExecute "powershell.exe", args, "", "open", 0
