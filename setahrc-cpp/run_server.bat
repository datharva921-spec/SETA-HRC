@echo off
title SETA-HRC C++ HTTP REST API Server (Port 8000)
cd /d "%~dp0"
if not exist "bin\setahrc.exe" (
    echo Binary not found. Building first...
    call build.bat
)
cls
echo ========================================================
echo Starting SETA-HRC C++ REST API Server on Port 8000
echo ========================================================
bin\setahrc.exe --server
pause
