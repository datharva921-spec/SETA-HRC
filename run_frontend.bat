@echo off
title SETA-HRC React Frontend Server
echo ========================================================
echo Starting SETA-HRC Vite React Frontend on http://localhost:3000
echo ========================================================
cd /d "%~dp0setahrc-frontend\SETA-HRC-Emergency-Coordination-Frontend\artifacts\seta-hrc"
pnpm run dev
pause
