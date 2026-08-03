@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
 "$ws = New-Object -ComObject WScript.Shell;" ^
 "$lnk = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\Marketplace Search.lnk');" ^
 "$lnk.TargetPath = '%~dp0Start Marketplace Search.bat';" ^
 "$lnk.WorkingDirectory = '%~dp0';" ^
 "$lnk.IconLocation = '%~dp0icon.ico';" ^
 "$lnk.Description = 'Search Facebook Marketplace';" ^
 "$lnk.Save()"
if errorlevel 1 (
  echo Could not create the shortcut.
) else (
  echo Done! A "Marketplace Search" icon is now on the Desktop.
)
pause
