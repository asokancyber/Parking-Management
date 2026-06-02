@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

echo.
echo ============================================================
echo   ParkSphere Enterprise - First-time setup
echo ============================================================
echo.

REM ---- Check Node ------------------------------------------------------------
where node >nul 2>&1
if errorlevel 1 (
  echo [X] Node.js is not installed or not on PATH.
  echo     Install Node 18.18+ from https://nodejs.org and re-run.
  goto :fail
)

REM ---- Check / start Docker --------------------------------------------------
where docker >nul 2>&1
if errorlevel 1 (
  echo [X] Docker is not installed or not on PATH.
  echo     Install Docker Desktop from https://www.docker.com/products/docker-desktop/
  goto :fail
)

call :ensure_docker_running
if errorlevel 1 goto :fail

REM ---- Env files -------------------------------------------------------------
if not exist "apps\api\.env" (
  echo [.] Creating apps\api\.env from template
  copy /Y ".env.example" "apps\api\.env" >nul
) else (
  echo [=] apps\api\.env already exists - leaving as is
)
if not exist "apps\web\.env.local" (
  echo [.] Creating apps\web\.env.local from template
  copy /Y ".env.example" "apps\web\.env.local" >nul
) else (
  echo [=] apps\web\.env.local already exists - leaving as is
)

REM ---- npm install -----------------------------------------------------------
echo [.] Installing workspaces (this can take a few minutes the first time)...
call npm install
if errorlevel 1 goto :fail

REM ---- Postgres + Redis ------------------------------------------------------
echo [.] Starting Postgres + Redis containers...
call npm run infra:up
if errorlevel 1 goto :fail

REM ---- Wait for Postgres to be ready -----------------------------------------
echo [.] Waiting for Postgres to accept connections...
set /a tries=0
:waitpg
docker exec parksphere-postgres pg_isready -U parksphere -d parksphere >nul 2>&1
if not errorlevel 1 goto :pgready
set /a tries+=1
if !tries! GEQ 30 (
  echo [X] Postgres did not become ready in time. Check: docker logs parksphere-postgres
  goto :fail
)
timeout /t 1 /nobreak >nul
goto :waitpg
:pgready
echo [v] Postgres ready.

REM ---- Push schema --------------------------------------------------------
REM Dev uses `prisma db push` for schema sync (no migration files / prompts).
REM For production-shaped migrations, switch to `npm run db:migrate:postgres`.
echo [.] Pushing schema to Postgres + generating Prisma client...
call npm run db:push:postgres
if errorlevel 1 goto :fail

REM ---- Seed ------------------------------------------------------------------
echo [.] Seeding demo data...
call npm run db:seed
if errorlevel 1 goto :fail

echo.
echo ============================================================
echo   Setup complete. Run start.bat to launch ParkSphere.
echo ============================================================
echo.
pause
exit /b 0


REM =============================================================================
REM Subroutines
REM =============================================================================

:ensure_docker_running
REM Is the daemon already up?
docker info >nul 2>&1
if not errorlevel 1 (
  echo [v] Docker is running.
  exit /b 0
)

REM Try common Docker Desktop install paths.
set "DOCKER_EXE="
if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" set "DOCKER_EXE=%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
if not defined DOCKER_EXE if exist "%LocalAppData%\Docker\Docker\Docker Desktop.exe" set "DOCKER_EXE=%LocalAppData%\Docker\Docker\Docker Desktop.exe"

if not defined DOCKER_EXE (
  echo [X] Docker Desktop is not running and I could not find Docker Desktop.exe
  echo     in the usual install locations. Start Docker Desktop manually and re-run.
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
REM Show a heartbeat every ~10s so the user knows it's not stuck.
set /a mod=!dtries! %% 10
if !mod! == 0 echo     ...still waiting (!dtries!s)
timeout /t 1 /nobreak >nul
goto :waitdocker


:fail
echo.
echo Setup did not complete. See the message above.
pause
exit /b 1
