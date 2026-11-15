@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
  start "English Tutor Guard" /min py -3 "%~dp0windows_guard.py"
) else (
  where python >nul 2>nul
  if errorlevel 1 (
    echo Python 3 is required. Install it from https://www.python.org/downloads/windows/
    echo After installation run this file again.
    pause
    exit /b 1
  )
  start "English Tutor Guard" /min python "%~dp0windows_guard.py"
)
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:8765/"
echo English Tutor should open in the browser.
echo Do not close the separate guard window if you want Steam blocked.
pause
