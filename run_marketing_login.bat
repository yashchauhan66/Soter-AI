@echo off
cd /d "%~dp0"
chcp 65001 >nul
title Soter-AI Marketing Account Login
echo =====================================================================
echo  SOTER-AI AUTONOMOUS MARKETING - ONE-TIME ACCOUNT LOGIN
echo =====================================================================
echo.
echo Launching your marketing browser with tabs for:
echo  1. LinkedIn
echo  2. X / Twitter
echo  3. Reddit
echo  4. ProductHunt
echo  5. Dev.to
echo.
echo Log into each tab. Once finished, close the browser window to save sessions.
echo.
python .antigravity/marketing_engine/login_accounts.py
echo.
echo Done! All account sessions have been saved.
pause
