@echo off
setlocal
cd /d "%~dp0"
title ManhwaRecap AI Studio
color 0b
cls

echo =======================================================================
echo          MANHWARECAP AI STUDIO - 1-CLICK LAUNCHER
echo =======================================================================
echo.
echo [1/3] Checking environment and Node.js runtime...

:: 1. Check if Node.js is already in PATH
node -v >nul 2>nul
if %errorlevel% equ 0 goto NODE_FOUND

:: 2. Check standard Windows Node.js installation paths
if exist "%ProgramFiles%\nodejs\node.exe" goto ADD_NODE_PF
if exist "%SystemDrive%\Program Files\nodejs\node.exe" goto ADD_NODE_PF
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" goto ADD_NODE_LOCAL

goto INSTALL_NODE

:ADD_NODE_PF
set "PATH=%ProgramFiles%\nodejs;%PATH%"
goto CHECK_NODE_AGAIN

:ADD_NODE_LOCAL
set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
goto CHECK_NODE_AGAIN

:CHECK_NODE_AGAIN
node -v >nul 2>nul
if %errorlevel% equ 0 goto NODE_FOUND

:INSTALL_NODE
color 0e
echo.
echo =======================================================================
echo   [NOTICE] Node.js was not detected on your computer.
echo   Node.js is free and required to run the local studio server.
echo =======================================================================
echo.
echo Checking for Windows winget auto-installer...
where winget >nul 2>nul
if %errorlevel% neq 0 goto OPEN_BROWSER_NODE

echo Installing Node.js LTS automatically via winget...
echo Please accept the Windows prompt if it asks for permission...
echo.
winget install OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
if %errorlevel% equ 0 goto WINGET_SUCCESS

:OPEN_BROWSER_NODE
color 0c
echo.
echo Automatic installer not available.
echo Opening the official Node.js download page in your browser:
start https://nodejs.org/en/download
echo.
echo Please download and run the Node.js installer (LTS version).
echo After installing, close this window and double-click LAUNCH_APP.bat again!
goto PAUSE_EXIT

:WINGET_SUCCESS
echo.
echo =======================================================================
echo   Node.js installation completed!
echo   Please CLOSE this window and double-click LAUNCH_APP.bat again
echo   so Windows loads the newly installed Node.js into PATH.
echo =======================================================================
goto PAUSE_EXIT

:NODE_FOUND
echo [OK] Node.js detected and ready!
echo.

:: 3. Setup .env file if missing
echo [2/3] Checking project configuration...
if exist ".env" goto ENV_EXISTS
if exist ".env.example" copy ".env.example" ".env" >nul
if not exist ".env" echo PORT=3000 > .env
echo [OK] Created .env configuration.
:ENV_EXISTS

:: 4. Check dependencies (node_modules)
if exist "node_modules\" goto MODULES_EXIST
echo.
echo =======================================================================
echo   [FIRST TIME SETUP] Installing requirements and libraries...
echo   This only happens once on your very first run (takes 1-2 minutes).
echo   Please wait...
echo =======================================================================
echo.
call npm install
if %errorlevel% neq 0 goto NPM_RETRY
echo [OK] All requirements installed successfully!
echo.
goto MODULES_EXIST

:NPM_RETRY
echo [NOTICE] Retrying npm install with --force...
call npm install --force
if %errorlevel% neq 0 goto NPM_FAIL
echo [OK] Requirements installed!
echo.

:MODULES_EXIST

:: 5. Launch web browser after 3 seconds in background
echo [3/3] Starting studio server at http://localhost:3000...
echo Opening your web browser in 3 seconds...
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"

:: 6. Start Server
color 0a
echo =======================================================================
echo   APP RUNNING AT: http://localhost:3000
echo.
echo   - Keep this window open while using the app.
echo   - To stop the server at any time, press Ctrl+C or close this window.
echo =======================================================================
echo.

call npm run dev
if %errorlevel% neq 0 goto TRY_NPX
goto PAUSE_EXIT

:TRY_NPX
echo.
echo [NOTICE] Trying direct runner: npx tsx server.ts...
call npx tsx server.ts
goto PAUSE_EXIT

:NPM_FAIL
color 0c
echo.
echo =======================================================================
echo   [ERROR] Failed to install npm packages.
echo   Please check your internet connection and try running again.
echo =======================================================================
goto PAUSE_EXIT

:PAUSE_EXIT
echo.
echo =======================================================================
echo Press any key to close this window...
echo =======================================================================
pause >nul
