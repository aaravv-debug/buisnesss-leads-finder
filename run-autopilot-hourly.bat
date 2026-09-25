@echo off
title LeadPulse 24/7 Hourly Outreach Engine
cd /d "%~dp0"
echo ====================================================
echo   LeadPulse 24/7 Hourly Autonomous Outreach Loop
echo   Delivering ~30 verified client pitches every 60 min
echo ====================================================

:loop
echo.
echo [%TIME%] Starting hourly client outreach cycle...
node scripts/hourly-worker.js
echo.
echo [%TIME%] Hourly batch completed! Waiting 60 minutes for next run...
timeout /t 3600 /nobreak
goto loop
