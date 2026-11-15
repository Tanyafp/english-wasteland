# Create a per-user Windows Startup shortcut. Does not require administrator rights.
$startup = [Environment]::GetFolderPath("Startup")
$launcher = Join-Path $PSScriptRoot "guard-only.cmd"
$shortcutPath = Join-Path $startup "English Tutor Guard.lnk"
$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $env:ComSpec
$shortcut.Arguments = '/c ""' + $launcher + '""'
$shortcut.WorkingDirectory = $PSScriptRoot
$shortcut.WindowStyle = 7
$shortcut.Description = "English Tutor local Steam guard"
$shortcut.Save()
Write-Host "Startup shortcut created:" $shortcutPath
Write-Host "Start Windows normally next time. For today, run start-windows.cmd."
