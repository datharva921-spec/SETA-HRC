@echo off
title Build SETA-HRC C++ Engine
echo ========================================================
echo Building SETA-HRC C++ Engine (MinGW GCC)
echo ========================================================
if not exist "bin" mkdir bin
g++ -std=c++14 -O2 -Iinclude src/main.cpp -o bin/setahrc.exe -lws2_32
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Build completed! Binary created at bin/setahrc.exe
) else (
    echo [ERROR] Build failed. Check g++ installation.
)
pause
