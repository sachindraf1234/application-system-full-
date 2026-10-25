import {readFileSync} from 'node:fs';
import type {buildEvisaScripts} from './evisaScripts.js';

type Plan=ReturnType<typeof buildEvisaScripts>['plan'];
const template=readFileSync(new URL('./templates/evisa_local_workflow.py',import.meta.url),'utf8');
const safeName=(value:unknown)=>String(value||'draft').replace(/[^A-Za-z0-9_-]/g,'').slice(0,35)||'draft';

/** Explicitly local executable package. Never bundle actual documents or the user's
 * attached hard-coded real-candidate sample, and never run it on this server. */
export function buildEvisaLocalPackage(plan:Plan, fileNumber:unknown, folderPath:unknown, targetUrl:unknown) {
  const id=safeName(fileNumber);
  const folder=String(folderPath||'').trim().slice(0,500);
  const url=String(targetUrl||'').trim().slice(0,500);
  const script=template
    .replace('__EVISA_PLAN_JSON__',JSON.stringify(JSON.stringify(plan)))
    .replace('__EVISA_URL_JSON__',JSON.stringify(url))
    .replace('__EVISA_FOLDER_JSON__',JSON.stringify(folder));
  const pythonFilename=`evisa_local_workflow_${id}.py`;
  const batFilename=`run_evisa_local_${id}.bat`;
  const requirements='playwright>=1.58,<2\n';
  const bat=`@echo off\r\nsetlocal\r\ncd /d "%~dp0"\r\ntitle Local E-Visa Draft Assistant - ${id}\r\necho Local-only Playwright package. No CDP, hidden portal submission, or bundled identity documents.\r\nwhere py >nul 2>&1\r\nif %errorlevel%==0 (set "PY=py -3") else (set "PY=python")\r\n%PY% --version >nul 2>&1\r\nif errorlevel 1 (echo Install Python 3.10+ and add it to PATH. & pause & exit /b 1)\r\nif not exist "%~dp0.venv\\Scripts\\python.exe" (\r\n  %PY% -m venv "%~dp0.venv"\r\n  if errorlevel 1 (echo Could not create local virtual environment. & pause & exit /b 1)\r\n)\r\necho Review requirements.txt before installing dependencies.\r\nset /p INSTALL=Type INSTALL to set up Playwright, or anything else to cancel: \r\nif /I not "%INSTALL%"=="INSTALL" exit /b 1\r\n"%~dp0.venv\\Scripts\\python.exe" -m pip install -r "%~dp0requirements.txt"\r\nif errorlevel 1 (echo Dependency installation failed. & pause & exit /b 1)\r\n"%~dp0.venv\\Scripts\\python.exe" -m playwright install chromium\r\nif errorlevel 1 (echo Chromium setup failed. & pause & exit /b 1)\r\necho Review the generated Python and selected applicant before continuing.\r\nset /p RUN=Type RUN to open the local browser; no final submission will occur: \r\nif /I not "%RUN%"=="RUN" exit /b 1\r\n"%~dp0.venv\\Scripts\\python.exe" "%~dp0${pythonFilename}" --run\r\necho Workflow ended. Inspect the portal manually.\r\npause\r\n`;
  const readme=`LOCAL E-VISA DRAFT ASSISTANT — ${id}\n\nThis ZIP contains scripts and instructions ONLY. No passport, photo, permit or other applicant documents are included. It is not an official visa-submission integration.\n\nLOCAL FOLDER REFERENCE: ${folder||'(not set — supply --folder when running)'}\nPORTAL URL REFERENCE: ${url||'(not set — enter official URL when running)'}\n\nQUICK START (Windows): Review the .py and .bat files first; double-click ${batFilename}. It creates a private .venv beside the script and asks before installing Playwright/Chromium and before running. It does not enable remote debugging or use your everyday Chrome profile.\n\nCROSS-PLATFORM: python -m pip install -r requirements.txt; python -m playwright install chromium; python ${pythonFilename} (dry-run), then python ${pythonFilename} --run for a headed browser. Manual login and CAPTCHA are required.\n\nThe script pauses BEFORE each form stage and requires FILL. It attempts visible text fields only. Native dropdowns and unverified selectors need manual inspection. If you provide inspected unique --save-xpath and --next-xpath arguments, each Save/Next click requires a separate typed confirmation; by default neither is clicked. Final submission is NEVER performed.\n\nOPTIONAL LOCAL DOCUMENTS: Documents stay in your folder. To attach them after navigating manually to that portal stage, use --upload-local-docs --folder "YOUR_LOCAL_FOLDER" --document-map "YOUR_REVIEWED_MAP.json". The JSON map is a list such as [{"filename":"work_permit.pdf","xpath":"//input[@type='file']"}]. Inspect each upload field; each file requires UPLOAD confirmation. No recursive machine-wide scans. No OpenCV face recognition or guaranteed automatic photo positioning.\n\nBefore using real records, confirm consent, destination URL, every candidate field and every selector against the CURRENT official portal. The attached upstream example is candidate-specific, contains unverified automation and was not copied into this ZIP. Test on a nonproduction mock first.\n`;
  return {script,pythonFilename,bat,batFilename,requirements,readme};
}
