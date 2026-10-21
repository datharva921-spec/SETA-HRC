@echo off
title SETA-HRC FastAPI Backend Server
echo ========================================================
echo Starting SETA-HRC FastAPI Backend on http://localhost:8000
echo ========================================================
cd /d "%~dp0setahrc-backend"
call .\venv\Scripts\activate
python run.py
pause
