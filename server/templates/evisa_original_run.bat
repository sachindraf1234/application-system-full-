@echo off
title eVisa Romania Automation - [__ORIGINAL_ID__]
color 0B
:: Always switch active working directory to this script folder so running as administrator never defaults to C:\Windows\system32
cd /d "%~dp0"
echo ==============================================================================
echo       eVisa Romania Local Playwright ^& OpenCV Automation (Windows 1-Click)
echo       Target Applicant File: __ORIGINAL_ID__
echo ==============================================================================
echo.
echo [1/3] Checking Python installation on your PC...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Python is not installed or not added to your system PATH!
    echo.
    echo 1. Download Python from https://www.python.org/downloads/
    echo 2. Run the installer and MAKE SURE to check: "Add python.exe to PATH"
    echo.
    pause
    exit /b
)

echo Python found:
python --version
echo.

echo [2/3] Installing / Verifying required libraries (Playwright, OpenCV, NumPy, Pillow)...
python -m pip install --quiet --upgrade pip
python -m pip install "playwright>=1.45.0,<2.0.0" "python-dotenv>=1.0.0" "opencv-python>=4.8.0" "numpy>=1.24.0" "Pillow>=10.0.0" "pypdf>=5,<8"
echo Installing Chromium browser binaries for Playwright...
python -m playwright install chromium
echo.

echo ==============================================================================
echo   ISOLATED BROWSER AUTOMATION (Profile: AutomationProfile_TransArabian)
echo ==============================================================================
echo.
echo   - Launches an independent Chrome instance (no file locks on your main Chrome).
echo   - Your main Google Chrome (the operator) remains OPEN and untouched.
echo   - Saves your e-Visa session & cookies permanently in the isolated profile.
echo   - Multi-tab tracking is ENABLED: If an email verification link opens in a
echo     new tab, the script automatically detects and attaches to the new tab!
echo.
echo ==============================================================================
echo [3/3] Launching eVisa Romania Full Automation...
echo.

if exist "%~dp0evisa_automation___ORIGINAL_ID__.py" (
    python "%~dp0evisa_automation___ORIGINAL_ID__.py"
    goto script_done
) else if exist "%~dp0playwright_visa_workflow.py" (
    python "%~dp0playwright_visa_workflow.py"
    goto script_done
) else (
    for %%f in ("%~dp0*.py") do (
        python "%%f"
        goto script_done
    )
    echo [ERROR] Could not find python automation script in this directory!
)

:script_done
echo.
echo ==============================================================================
echo   Automation process finished or paused. Press any key to close this window.
echo ==============================================================================
pause
