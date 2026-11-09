@echo off
setlocal enabledelayedexpansion

:: 1. Force working directory to the folder containing this batch file
cd /d "%~dp0"

title ManhwaRecap AI Studio
color 0b
cls

echo =======================================================================
echo.
echo     M A N H W A R E C A P   A I   S T U D I O
echo.
echo                COMIC RECAP STUDIO - 1-CLICK LAUNCHER
echo =======================================================================
echo.
echo [1/3] Checking environment and Node.js runtime...

:: Check if portable node exists in bin\nodejs
if exist "bin\nodejs\node.exe" (
    set "PATH=%~dp0bin\nodejs;%PATH%"
)

:: Check if Node.js is available in current PATH or standard Windows folders
where node >nul 2>nul
if %errorlevel% neq 0 (
    if exist "%ProgramFiles%\nodejs\node.exe" (
        set "PATH=%ProgramFiles%\nodejs;%PATH%"
    ) else if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
        set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
    ) else if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" (
        set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
    )
)

:: Re-verify Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0e
    echo.
    echo =======================================================================
    echo   Node.js is not installed on this PC.
    echo   Downloading portable Node.js runtime automatically (No setup needed)...
    echo =======================================================================
    echo.
    
    if not exist "bin\" mkdir "bin"

    :: Try downloading portable Node.js 64-bit using curl
    where curl >nul 2>nul
    if %errorlevel% equ 0 (
        echo [INFO] Downloading official Node.js portable package (~30MB)...
        curl -L -o "bin\node-portable.zip" "https://nodejs.org/dist/v20.18.0/node-v20.18.0-win-x64.zip"
        
        if exist "bin\node-portable.zip" (
            echo [INFO] Extracting portable Node.js...
            where tar >nul 2>nul
            if %errorlevel% equ 0 (
                tar -xf "bin\node-portable.zip" -C "bin"
            ) else (
                powershell -Command "Expand-Archive -Path 'bin\node-portable.zip' -DestinationPath 'bin' -Force"
            )
            
            if exist "bin\node-v20.18.0-win-x64\node.exe" (
                if exist "bin\nodejs" rmdir /s /q "bin\nodejs" >nul 2>nul
                ren "bin\node-v20.18.0-win-x64" "nodejs"
                del /f /q "bin\node-portable.zip" >nul 2>nul
                set "PATH=%~dp0bin\nodejs;%PATH%"
                echo [OK] Portable Node.js installed successfully!
            )
        )
    )

    :: Check again after portable download
    where node >nul 2>nul
    if %errorlevel% neq 0 (
        :: If curl/portable download failed, try winget or open browser
        where winget >nul 2>nul
        if %errorlevel% equ 0 (
            echo.
            echo [INFO] Trying automatic installation via Windows winget...
            winget install OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
            echo.
            echo If installation finished, please CLOSE and RE-OPEN LAUNCH_APP.bat.
        ) else (
            color 0c
            echo.
            echo [ERROR] Please install Node.js manually:
            echo Opening official download page: https://nodejs.org/en/download
            start https://nodejs.org/en/download
        )
        echo.
        echo Press any key to exit...
        pause >nul
        exit /b 1
    )
)

for /f "tokens=*" %%v in ('node -v 2^>nul') do set "NODE_VER=%%v"
echo [OK] Node.js is ready: !NODE_VER!

:: 2. Setup .env configuration file if missing
if not exist ".env" (
    echo [2/3] Setting up local .env configuration...
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo [OK] Created .env configuration from template.
    ) else (
        echo PORT=3000 > .env
        echo [OK] Created default .env on port 3000.
    )
) else (
    echo [2/3] Configuration file .env is ready.
)

:: 3. Check and install dependencies (node_modules)
if not exist "node_modules\" (
    echo.
    echo =======================================================================
    echo   [FIRST TIME SETUP] Installing requirements and libraries...
    echo   This only happens once on your very first run (takes ~1-2 min).
    echo   Please wait...
    echo =======================================================================
    echo.
    call npm install
    if %errorlevel% neq 0 (
        color 0c
        echo.
        echo [ERROR] npm install failed. Retrying with --force...
        call npm install --force
        if %errorlevel% neq 0 (
            echo.
            echo [FATAL] Failed to install packages. Please check your internet connection.
            echo.
            pause
            exit /b 1
        )
    )
    echo.
    echo [OK] All requirements installed successfully!
)

:: 4. Launch browser automatically in background after a brief delay
echo [3/3] Launching server at http://localhost:3000...
echo.
echo Opening your web browser in 3 seconds...
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"

:: 5. Start the server
color 0a
echo =======================================================================
echo   APP RUNNING AT: http://localhost:3000
echo   
echo   - Keep this window open while using the app.
echo   - To stop the server at any time, press Ctrl+C or close this window.
echo =======================================================================
echo.

:: Start using npm run dev
call npm run dev

:: Fallback if npm run dev exited
if %errorlevel% neq 0 (
    echo.
    echo [NOTICE] Trying direct fallback runner: npx tsx server.ts...
    call npx tsx server.ts
)

echo.
echo [SERVER STOPPED]
echo.
pause
