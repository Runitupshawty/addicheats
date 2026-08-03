@echo off
setlocal
title Marketplace Search
cd /d "%~dp0"

rem Every path below is absolute (%~dp0 = this file's folder) so it does not
rem matter what the working directory is when this runs.

rem Double-clicking the .bat while still inside the .zip makes Windows copy
rem this one file to a temp folder and run it there, with none of the project
rem alongside it. Catch that before pip does.
if not exist "%~dp0app.py" goto :notextracted
if not exist "%~dp0scraper.py" goto :notextracted
if not exist "%~dp0static\index.html" goto :notextracted

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

if exist "%~dp0.venv\Scripts\python.exe" goto :run

echo.
echo  First-time setup: downloading what the app needs.
echo  This can take a few minutes and only happens once.
echo.
%PYCMD% -m venv "%~dp0.venv"
if errorlevel 1 goto :setupfail

if exist "%~dp0requirements.txt" goto :installreq
"%~dp0.venv\Scripts\python.exe" -m pip install --disable-pip-version-check "playwright>=1.45"
if errorlevel 1 goto :setupfail
goto :installbrowser

:installreq
"%~dp0.venv\Scripts\python.exe" -m pip install --disable-pip-version-check -r "%~dp0requirements.txt"
if errorlevel 1 goto :setupfail

:installbrowser
"%~dp0.venv\Scripts\python.exe" -m playwright install chromium
if errorlevel 1 goto :setupfail

:run
echo.
echo  Starting Marketplace Search - your web browser will open in a moment.
echo  KEEP THIS BLACK WINDOW OPEN while you use the app.
echo  Close it when you're done.
echo.
"%~dp0.venv\Scripts\python.exe" "%~dp0app.py"
if errorlevel 1 pause
exit /b 0

:notextracted
echo.
echo  This folder is missing files it needs to run.
echo.
echo  The usual cause: the app was started from INSIDE the zip file.
echo  Windows only unpacks the one file you clicked, so nothing else is there.
echo.
echo  To fix it:
echo   1. Right-click "Marketplace Search.zip" and choose "Extract All...".
echo   2. Open the extracted "Marketplace Search" folder.
echo   3. Double-click "Start Marketplace Search" in THAT folder.
echo.
echo  Current folder: %~dp0
echo.
pause
exit /b 1

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
