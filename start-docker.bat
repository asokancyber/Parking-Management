@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

echo.
echo ============================================================
echo   ParkSphere Enterprise - Starting
echo ============================================================
echo.

REM ---- Sanity: env files exist -----------------------------------------------
if not exist "apps\api\.env" (
  echo [X] apps\api\.env is missing. Run setup.bat first.
  goto :fail
)
if not exist "apps\web\.env.local" (
  echo [X] apps\web\.env.local is missing. Run setup.bat first.
  goto :fail
)

REM ---- Sanity: node_modules --------------------------------------------------
if not exist "node_modules" (
  echo [X] Dependencies are not installed. Run setup.bat first.
  goto :fail
)

REM ---- Docker ---------------------------------------------------------------
where docker >nul 2>&1
if errorlevel 1 (
  echo [X] Docker is not on PATH. Install Docker Desktop.
  goto :fail
)

call :ensure_docker_running
if errorlevel 1 goto :fail

REM ---- Postgres + Redis (idempotent: up does nothing if already running) ----
echo [.] Ensuring Postgres + Redis are up...
call npm run infra:up
if errorlevel 1 goto :fail

REM ---- Wait briefly for Postgres ---------------------------------------------
set /a tries=0
:waitpg
docker exec parksphere-postgres pg_isready -U parksphere -d parksphere >nul 2>&1
if not errorlevel 1 goto :pgready
set /a tries+=1
if !tries! GEQ 30 (
  echo [X] Postgres did not become ready. Check: docker logs parksphere-postgres
  goto :fail
)
timeout /t 1 /nobreak >nul
goto :waitpg
:pgready

echo.
echo ============================================================
echo   API   - http://localhost:4000
echo   Web   - http://localhost:3000
echo   Kiosk - http://localhost:3000/gate/GATE-A-ENTRY/kiosk
echo   Admin - http://localhost:3000/admin/login
echo   Driver - http://localhost:3000/scan
echo.
echo   Browser will open automatically when the web app is ready.
echo   Press Ctrl+C to stop.
echo ============================================================
echo.

REM ---- Spawn a background watcher that opens the browser once port 3000 is up
start "" /b powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\open-when-ready.ps1"

REM ---- Launch ---------------------------------------------------------------
call npm run dev
exit /b %ERRORLEVEL%


REM =============================================================================
REM Subroutines
REM =============================================================================

:ensure_docker_running
docker info >nul 2>&1
if not errorlevel 1 (
  echo [v] Docker is running.
  exit /b 0
)

set "DOCKER_EXE="
if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" set "DOCKER_EXE=%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
if not defined DOCKER_EXE if exist "%LocalAppData%\Docker\Docker\Docker Desktop.exe" set "DOCKER_EXE=%LocalAppData%\Docker\Docker\Docker Desktop.exe"

if not defined DOCKER_EXE (
  echo [X] Docker Desktop is not running and Docker Desktop.exe was not found
  echo     in the usual locations. Start Docker Desktop manually and re-run.
  exit /b 1
)

echo [.] Docker daemon is not running. Launching Docker Desktop...
start "" "!DOCKER_EXE!"

echo [.] Waiting for Docker to be ready (this can take 30-90 seconds the first time)...
set /a dtries=0
:waitdocker
docker info >nul 2>&1
if not errorlevel 1 (
  echo [v] Docker is ready.
  exit /b 0
)
set /a dtries+=1
if !dtries! GEQ 120 (
  echo [X] Docker did not become ready within ~2 minutes.
  echo     Open Docker Desktop manually, wait for the whale icon to settle, then re-run.
  exit /b 1
)
set /a mod=!dtries! %% 10
if !mod! == 0 echo     ...still waiting (!dtries!s)
timeout /t 1 /nobreak >nul
goto :waitdocker


:fail
echo.
pause
exit /b 1
