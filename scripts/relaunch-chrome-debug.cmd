@echo off
REM Relaunch the Soter QA Chrome profile with CDP debug port + Soter extension.
REM Chrome 147 does not reliably expose CDP on the default user profile, so use C:\tmp.
REM Log into AI sites once in this QA profile, then rerun scripts\live-external-ai-cdp.mjs.
set "PROFILE=C:\tmp\soter-chrome-qa-profile"
for %%I in ("%~dp0..\apps\extension\dist\extension") do set "EXT=%%~fI"
if not exist "%PROFILE%" mkdir "%PROFILE%"
echo Closing existing Chrome...
taskkill /IM chrome.exe /F >nul 2>&1
ping 127.0.0.1 -n 3 >nul
echo Launching Chrome (profile: %PROFILE%) on port 9222 with Soter loaded...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --remote-debugging-port=9222 ^
  --remote-debugging-address=127.0.0.1 ^
  --user-data-dir="%PROFILE%" ^
  --profile-directory=Default ^
  --no-first-run ^
  --load-extension="%EXT%" ^
  https://chatgpt.com/
echo Done. Now run:  node scripts/live-external-ai-cdp.mjs
