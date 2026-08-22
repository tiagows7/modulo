' Hide console window when starting posto bridges at Windows logon
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
rootDir = fso.GetParentFolderName(scriptDir)
nodeCmd = "node """ & rootDir & "\scripts\posto.mjs"""
sh.CurrentDirectory = rootDir
sh.Run nodeCmd, 0, False
