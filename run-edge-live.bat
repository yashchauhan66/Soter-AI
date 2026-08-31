@echo off
REM Live Edge runtime-lab battery launcher (detached process, logs to edge-live-run.log)
set "PATH=C:\Program Files\Git\usr\bin;%PATH%"
cd /d "c:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard"
echo STARTED %date% %time% > edge-live-run.log
call npx playwright test --config playwright.extension.config.ts --project=edge --reporter=list >> edge-live-run.log 2>&1
echo EXIT_CODE_%ERRORLEVEL% >> edge-live-run.log

