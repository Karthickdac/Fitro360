' Windowless installer launcher — kept as an alternative to install.bat
' for environments where Smart App Control is disabled and operators
' prefer no CMD flash at all. See install.bat for the recommended path.
Option Explicit

Dim fso, here, args, sh
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)

If Not fso.FileExists(here & "\install.ps1") Then
  MsgBox "install.ps1 is missing from this folder. Please re-extract the entire release zip.", _
         vbCritical, "Fitro360 — install error"
  WScript.Quit 1
End If

' -WorkingDirectory + relative -File survives install folders that
' contain spaces (e.g. C:\Users\John Smith\Downloads\...).
args = "-NoProfile -WindowStyle Hidden -Command ""Start-Process powershell.exe -Verb RunAs -WindowStyle Hidden -WorkingDirectory '" & here & "' -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File','install.ps1'"""
Set sh = CreateObject("Shell.Application")
sh.ShellExecute "powershell.exe", args, "", "open", 0
