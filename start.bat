@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title ParkSphere Enterprise

echo.
echo ============================================================
echo   ParkSphere Enterprise - Starting
echo ============================================================
echo.

REM ============================================================
REM 0. Free our ports
REM ============================================================
call :kill_port 3000
call :kill_port 4000

REM ============================================================
REM 1. Toolchain
REM ============================================================
where node >nul 2>&1
if errorlevel 1 (
  echo [X] Node.js not on PATH. Install from https://nodejs.org
  goto :hold
)
where npm >nul 2>&1
if errorlevel 1 (
  echo [X] npm not on PATH.
  goto :hold
)
for /f "delims=" %%v in ('node --version') do echo   Node %%v
for /f "delims=" %%v in ('npm --version')  do echo   npm  v%%v

REM ============================================================
REM 2. Env files
REM ============================================================
if not exist "apps\api\.env" (
  echo   creating apps\api\.env
  copy /Y ".env.nodocker.example" "apps\api\.env" >nul
  if errorlevel 1 (echo [X] template missing & goto :hold)
)
if not exist "apps\web\.env.local" (
  echo   creating apps\web\.env.local
  copy /Y ".env.nodocker.example" "apps\web\.env.local" >nul
  if errorlevel 1 (echo [X] template missing & goto :hold)
)

REM ============================================================
REM 3. Dependencies + Prisma client
REM    npm workspaces hoist to root node_modules; we also need
REM    the generated Prisma client at node_modules\.prisma\client.
REM ============================================================
set "NEED_INSTALL=0"
if not exist "node_modules" set "NEED_INSTALL=1"
if not exist "node_modules\.prisma\client" set "NEED_INSTALL=1"

if "%NEED_INSTALL%"=="1" (
  echo   installing dependencies...
  call npm install
  if errorlevel 1 (echo [X] npm install failed & goto :hold)
)

REM ============================================================
REM 4. Database
REM    Always run db push so schema changes auto-apply when you
REM    pull new code. Push is idempotent (~2-3s when no change).
REM ============================================================
echo   syncing SQLite schema...
call npm run db:push:sqlite
if errorlevel 1 (echo [X] schema push failed & goto :hold)
if not exist "apps\api\prisma\parksphere.db.seeded" (
  echo   seeding demo data...
  call npm run db:seed
  if errorlevel 1 (echo [X] seed failed & goto :hold)
  echo seeded > "apps\api\prisma\parksphere.db.seeded"
)

REM ============================================================
REM 5. Clear partial Next.js cache
REM ============================================================
if exist "apps\web\.next" (
  if not exist "apps\web\.next\BUILD_ID" (
    echo   clearing partial .next cache
    rmdir /S /Q "apps\web\.next" >nul 2>&1
  )
)

REM ============================================================
REM 6. Launch API and Web in separate windows.
REM
REM    We do NOT use `concurrently` because Next.js on Windows
REM    exits silently when its stdin is piped through another
REM    process. Each server runs in its own real cmd window so
REM    Next.js (and Nest watch) get a proper interactive shell
REM    and stay alive.
REM ============================================================
echo.
echo   launching API window...
start "ParkSphere API" cmd /k "npm run dev:api"

echo   waiting for API to come up...
call :wait_http "http://localhost:4000/api/v1/health" 30

echo   launching Web window...
start "ParkSphere Web" cmd /k "npm run dev:web"

echo   waiting for Web to come up...
call :wait_http "http://localhost:3000" 60

echo.
echo ============================================================
echo   Both servers are up.
echo     Web    http://localhost:3000
echo     API    http://localhost:4000/api/v1
echo     Health http://localhost:4000/api/v1/health
echo.
echo   Two separate windows are now running:
echo     "ParkSphere API"  - backend logs
echo     "ParkSphere Web"  - frontend logs
echo.
echo   To stop everything: close both of those windows
echo   (or run this script again - it auto-kills the ports).
echo ============================================================
echo.

start "" http://localhost:3000

:hold
echo Press any key to close THIS launcher window. The two server
echo windows will keep running until you close them individually.
pause >nul
exit /b 0


REM ============================================================
REM :kill_port <port>
REM
REM Finds every process LISTENING on the port (IPv4 + IPv6) and
REM force-kills its whole process tree. Robust against npm/Node
REM orphan trees where the parent shell exits but child node
REM processes keep the socket alive.
REM ============================================================
:kill_port
set "PORT=%~1"
set "KILLED=0"
REM Two findstr pipes: first narrow to LISTENING rows, then to our port.
REM Trailing space on the port match avoids :40000 matching :4000.
for /f "tokens=5" %%a in ('netstat -ano -p TCP ^| findstr "LISTENING" ^| findstr ":%PORT% "') do (
  taskkill /F /T /PID %%a >nul 2>&1
  if not errorlevel 1 (
    echo   killed PID %%a on port %PORT%
    set "KILLED=1"
  )
)
if "%KILLED%"=="0" (
  echo   port %PORT% is free
) else (
  REM Give Windows a beat to release the socket before the next start.
  timeout /t 1 /nobreak >nul
)
exit /b 0


REM ============================================================
REM :wait_http <url> <maxSeconds>
REM Polls the URL until it responds, or maxSeconds elapses.
REM ============================================================
:wait_http
set "URL=%~1"
set "MAXS=%~2"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$deadline=(Get-Date).AddSeconds(%MAXS%); while ((Get-Date) -lt $deadline) { try { $r = Invoke-WebRequest -Uri '%URL%' -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop; if ($r.StatusCode -lt 500) { exit 0 } } catch { Start-Sleep -Seconds 1 } } ; exit 1"
if errorlevel 1 (
  echo   [!] %URL% did not respond within %MAXS%s. Check the spawned window for errors.
)
exit /b 0
