@echo off
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
  py -3 "%~dp0windows_guard.py"
) else (
  python "%~dp0windows_guard.py"
)
