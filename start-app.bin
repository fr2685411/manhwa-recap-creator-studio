#!/usr/bin/env bash
# =======================================================================
# ManhwaRecap AI Studio - 1-Click Binary Launcher (Linux & macOS)
# =======================================================================

set -e

# Change directory to the folder containing this script
cd "$(dirname "$0")"

echo "======================================================================="
echo "       🎬 MANHWARECAP AI STUDIO - 1-CLICK LAUNCHER"
echo "======================================================================="

# 1. Check if Node.js is installed
if ! command -v node >/dev/null 2>&1; then
    echo "❌ [ERROR] Node.js is not installed!"
    echo "Please install Node.js 18+ or 20+ from https://nodejs.org/"
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "https://nodejs.org/"
    elif command -v open >/dev/null 2>&1; then
        open "https://nodejs.org/"
    fi
    exit 1
fi

echo "✓ Node.js detected: $(node -v)"

# 2. Check and copy .env
if [ ! -f ".env" ]; then
    echo "⚙️ Initializing .env configuration from .env.example..."
    if [ -f ".env.example" ]; then
        cp ".env.example" ".env"
    else
        echo "PORT=3000" > .env
    fi
    echo "✓ .env configured."
fi

# 3. Check and install dependencies if node_modules missing
if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 [FIRST TIME SETUP] Installing requirements and npm packages..."
    echo "Please wait 1-2 minutes while packages download..."
    npm install
    echo "✓ All requirements installed successfully!"
fi

# 4. Open browser in background after 2 seconds
(
    sleep 2
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "http://localhost:3000" >/dev/null 2>&1 || true
    elif command -v open >/dev/null 2>&1; then
        open "http://localhost:3000" >/dev/null 2>&1 || true
    fi
) &

# 5. Launch the unified frontend + backend server
echo ""
echo "======================================================================="
echo " 🚀 SERVER RUNNING AT: http://localhost:3000"
echo " Opening browser automatically..."
echo " Press Ctrl+C to stop the server at any time."
echo "======================================================================="
echo ""

exec npm run dev
