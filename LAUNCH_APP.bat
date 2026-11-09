@echo off
title ManhwaRecap AI Studio - 1-Click Launcher
color 0b
cls

echo =======================================================================
echo.
echo    __  __             _                      ____                         
echo   ^|  \/  ^| __ _ _ __ ^| ^|____      ____ _   ^|  _ \ ___  ___ __ _ _ __   
echo   ^| ^|\/^| ^|/ _` ^| '_ \^| '_ \ \ /\ / / _` ^|  ^| ^|_) / _ \/ __/ _` ^| '_ \  
echo   ^| ^|  ^| ^| (_^| ^| ^| ^| ^| ^| ^| \ V  V / (_^| ^|  ^|  _ <  __/ (_^| (_^| ^| ^|_) ^| 
echo   ^|_^|  ^|_^|\__,_^|_^| ^|_^|_^| ^|_^|\_/\_/ \__,_^|  ^|_^| \_\___^|\___\__,_^| .__/  
echo                                                              ^|_^|     
echo                     STUDIO 1-CLICK LAUNCHER
echo =======================================================================
echo.

:: 1. Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0c
    echo [ERROR] Node.js is not detected on your system!
    echo.
    echo Node.js 18+ or 20+ is required to run the frontend and backend.
    echo.
    where winget >nul 2>nul
    if %errorlevel% equ 0 (
        echo Attempting automatic installation via winget...
        echo Please allow the Windows prompt if it asks for permission.
        echo.
        winget install OpenJS.NodeJS -e --silent
        echo.
        echo If installation completed, please close and re-open this file.
    ) else (
        echo Opening Node.js download page in your browser...
        start https://nodejs.org/
    )
    echo.
    pause
    exit /b 1
)

:: 2. Setup .env if missing
if not exist ".env" (
    echo [INFO] Initializing .env configuration from .env.example...
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo [INFO] Created .env successfully.
    ) else (
        echo PORT=3000 > .env
        echo [INFO] Created default .env on port 3000.
    )
)

:: 3. Check and install dependencies if node_modules does not exist
if not exist "node_modules\" (
    echo.
    echo =======================================================================
    echo  [FIRST TIME SETUP] Installing requirements and dependencies...
    echo  This only takes about 1-2 minutes on first run. Please wait!
    echo =======================================================================
    echo.
    call npm install
    if %errorlevel% neq 0 (
        color 0c
        echo.
        echo [ERROR] Failed to install requirements. Please check your internet connection.
        pause
        exit /b 1
    )
    echo.
    echo [SUCCESS] All requirements and packages installed successfully!
    echo.
)

:: 4. Launch default web browser after short delay in background
echo [INFO] Starting ManhwaRecap Studio Server on http://localhost:3000...
echo [INFO] Opening your browser in 2 seconds...
echo.

start "" powershell -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:3000'"

:: 5. Start unified frontend + backend server
color 0a
echo =======================================================================
echo   SERVER RUNNING! 
echo   URL: http://localhost:3000
echo   To stop the server at any time, press Ctrl+C or close this window.
echo =======================================================================
echo.

call npm run dev

if %errorlevel% neq 0 (
    echo.
    echo [NOTICE] Server stopped or exited with code %errorlevel%.
    pause
)
