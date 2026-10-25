@echo off
title SETA-HRC C++ Interactive Terminal (DSA Engine)
cd /d "%~dp0"
if not exist "bin\setahrc.exe" (
    echo Binary not found. Building first...
    call build.bat
)
cls
bin\setahrc.exe
pause
