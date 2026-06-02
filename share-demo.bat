@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title ParkSphere — Share demo

echo.
echo ============================================================
echo   ParkSphere — Share a demo URL with your client
echo ============================================================
echo.
echo This script enables single-origin mode (one URL serves web + API + WS),
echo so you only need ONE ngrok / Cloudflare tunnel to share with the client.
echo.
echo Setup steps you do ONCE:
echo   1. Sign up free at https://dashboard.ngrok.com/signup
echo   2. Copy your authtoken from https://dashboard.ngrok.com/get-started/your-authtoken
echo   3. Install ngrok:
echo        winget install ngrok.ngrok
echo      ...or download from https://ngrok.com/download
echo   4. Authenticate ngrok with your token:
echo        ngrok config add-authtoken YOUR_TOKEN
echo.
echo Press any key once you've installed + authenticated ngrok.
echo Or Ctrl+C to cancel.
pause >nul

REM ---- Flip the web env to same-origin mode ----------------------------
echo.
echo [.] Switching web to same-origin mode (NEXT_PUBLIC_API_BASE_URL='') ...
(
  echo # Demo mode — all API + WS traffic proxies through Next.js
  echo # so a single tunnel URL serves everything.
  echo NEXT_PUBLIC_API_BASE_URL=
  echo NEXT_PUBLIC_WS_URL=
) > "apps\web\.env.local"
echo [v] Wrote apps\web\.env.local

REM ---- Boot the stack -------------------------------------------------
echo.
echo [.] Starting the stack in a separate window (start.bat)...
start "ParkSphere — Stack" cmd /k "start.bat"

echo.
echo [.] Waiting 25s for the stack to come up...
timeout /t 25 /nobreak

REM ---- Health check ---------------------------------------------------
where curl >nul 2>&1
if not errorlevel 1 (
  for /f %%i in ('curl -s -o nul -w "%%{http_code}" http://localhost:3000') do set "WEBSTAT=%%i"
  echo [.] Web at localhost:3000 returned: %WEBSTAT%
)

REM ---- Spawn ngrok ----------------------------------------------------
echo.
echo ============================================================
echo   Starting ngrok tunnel on port 3000
echo ============================================================
echo   The public URL will appear below as "Forwarding ... -^> http://localhost:3000".
echo   Send THAT URL (the https one) to your client.
echo.
echo   Leave this window AND the "ParkSphere — Stack" window open while
echo   the client is testing. Closing either kills the demo.
echo ============================================================
echo.
ngrok http 3000
