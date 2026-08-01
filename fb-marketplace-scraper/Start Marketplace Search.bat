@echo off
setlocal
title Marketplace Search
cd /d "%~dp0"

set "PYCMD="
where py >nul 2>nul
if not errorlevel 1 set "PYCMD=py -3"
if not defined PYCMD (
  where python >nul 2>nul
  if not errorlevel 1 set "PYCMD=python"
)
if not defined PYCMD goto :nopython
%PYCMD% --version >nul 2>nul
if errorlevel 1 goto :nopython

if exist ".venv\Scripts\python.exe" goto :run

echo.
echo  First-time setup: downloading what the app needs.
echo  This can take a few minutes and only happens once.
echo.
%PYCMD% -m venv .venv
if errorlevel 1 goto :setupfail
".venv\Scripts\python.exe" -m pip install --disable-pip-version-check -r requirements.txt
if errorlevel 1 goto :setupfail
".venv\Scripts\python.exe" -m playwright install chromium
if errorlevel 1 goto :setupfail

:run
echo.
echo  Starting Marketplace Search - your web browser will open in a moment.
echo  KEEP THIS BLACK WINDOW OPEN while you use the app.
echo  Close it when you're done.
echo.
".venv\Scripts\python.exe" app.py
if errorlevel 1 pause
exit /b 0

:nopython
echo.
echo  Python is not installed on this computer yet. One-time fix:
echo.
echo   1. Go to  https://www.python.org/downloads/  and click Download.
echo   2. Run the installer and TICK THE BOX "Add python.exe to PATH".
echo   3. Double-click this file again.
echo.
pause
exit /b 1

:setupfail
echo.
echo  Setup did not finish. Check your internet connection and try again.
echo  If it keeps failing, delete the ".venv" folder in here and retry.
echo.
pause
exit /b 1
