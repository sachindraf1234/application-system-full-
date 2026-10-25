@echo off
title Launch Google Chrome with Remote Debugging (Port 9222)
:: Switch to batch script directory
cd /d "%~dp0"
echo ==============================================================================
echo Launching Google Chrome with Remote Debugging enabled on Port 9222...
echo Profile: transarabianofficial@gmail.com
echo This preserves your active tabs, logins, and cookies while allowing Playwright
echo to attach and open a NEW TAB automatically without restarting your browser!
echo ==============================================================================
echo.

:: Detect Chrome 64-bit, 32-bit, or LocalAppData location
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --restore-last-session
    echo Chrome launched successfully with Port 9222!
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --restore-last-session
    echo Chrome launched successfully with Port 9222!
) else if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
    start "" "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --restore-last-session
    echo Chrome launched successfully with Port 9222!
) else (
    start chrome.exe --remote-debugging-port=9222 --restore-last-session
    echo Chrome launched from PATH!
)

echo.
echo Now you can run run_evisa_automation_E25110721257414.bat - it will attach to this Chrome and open a new tab!
timeout /t 5
