' ─────────────────────────────────────────────────────────────────
'  Fitro360 Relay Agent — windowless installer launcher.
'
'  Double-click this file. No CMD or PowerShell console will be
'  shown at any point — the only windows you'll see are the UAC
'  consent prompt, the graphical setup wizard, and (after install)
'  the Fitro360 Relay Manager.
'
'  This file just launches install.ps1 elevated and hidden; all
'  the real work lives there.
' ─────────────────────────────────────────────────────────────────
Option Explicit

Dim fso, here, ps1, args, sh
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
ps1 = here & "\install.ps1"

If Not fso.FileExists(ps1) Then
  MsgBox "install.ps1 is missing from this folder. Please re-extract the entire release zip and try again.", _
         vbCritical, "Fitro360 — install error"
  WScript.Quit 1
End If

args = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & ps1 & """"
Set sh = CreateObject("Shell.Application")
' verb=runas triggers UAC; nShow=0 hides the launched powershell.exe entirely.
sh.ShellExecute "powershell.exe", args, "", "runas", 0
