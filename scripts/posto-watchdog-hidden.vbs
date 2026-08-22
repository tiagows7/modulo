' Watchdog oculto: sobe e mantem pontes do posto sem janela de console
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
rootDir = fso.GetParentFolderName(scriptDir)
nodeCmd = "node """ & rootDir & "\scripts\posto-watchdog.mjs"""
sh.CurrentDirectory = rootDir
sh.Run nodeCmd, 0, False
