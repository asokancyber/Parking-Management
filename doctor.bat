@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

echo.
echo ============================================================
echo   ParkSphere Enterprise - System Doctor
echo ============================================================
echo.

set "FAILED=0"

REM ────────────────────────────────────────────────────────────────
REM 1. Toolchain
REM ────────────────────────────────────────────────────────────────
where node >nul 2>&1
if errorlevel 1 (
  call :report_fail "Node.js" "not on PATH (install from https://nodejs.org)"
) else (
  for /f "tokens=*" %%v in ('node --version') do set "NV=%%v"
  call :report_ok "Node.js" "!NV!"
)

where npm >nul 2>&1
if errorlevel 1 (
  call :report_fail "npm" "not on PATH"
) else (
  for /f "tokens=*" %%v in ('npm --version') do set "NPV=%%v"
  call :report_ok "npm" "v!NPV!"
)

REM ────────────────────────────────────────────────────────────────
REM 2. Project files + install
REM ────────────────────────────────────────────────────────────────
if exist "apps\api\.env" (
  call :report_ok "apps\api\.env" "present"
) else (
  call :report_fail "apps\api\.env" "missing (run setup.bat)"
)

if exist "apps\web\.env.local" (
  call :report_ok "apps\web\.env.local" "present"
) else (
  call :report_fail "apps\web\.env.local" "missing (run setup.bat)"
)

if exist "node_modules" (
  call :report_ok "node_modules" "installed"
) else (
  call :report_fail "node_modules" "missing (run setup.bat)"
)

REM ────────────────────────────────────────────────────────────────
REM 3. Database
REM ────────────────────────────────────────────────────────────────
if exist "apps\api\prisma\parksphere.db" (
  call :report_ok "SQLite DB file" "apps\api\prisma\parksphere.db"
) else (
  call :report_fail "SQLite DB file" "missing (run setup.bat)"
)

REM ────────────────────────────────────────────────────────────────
REM 4. Running services
REM ────────────────────────────────────────────────────────────────
echo.
echo Probing local services...
echo.

call :http_check "API health" "http://localhost:4000/api/v1/health"
call :http_check "Web app   " "http://localhost:3000"

REM ────────────────────────────────────────────────────────────────
REM 5. API self-report
REM ────────────────────────────────────────────────────────────────
echo.
echo Asking API for its self-diagnostic...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-RestMethod -Uri 'http://localhost:4000/api/v1/health' -TimeoutSec 3 -ErrorAction Stop; $r | ConvertTo-Json -Depth 6 } catch { Write-Host '  (API not reachable - skip)' -ForegroundColor DarkYellow }"

REM ────────────────────────────────────────────────────────────────
REM 6. Login probe (only if API is up)
REM ────────────────────────────────────────────────────────────────
echo.
echo Probing seeded admin login...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $body = @{ email='admin@parksphere.local'; password='parksphere-admin' } | ConvertTo-Json; $r = Invoke-RestMethod -Uri 'http://localhost:4000/api/v1/auth/login' -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 5 -ErrorAction Stop; if ($r.token) { Write-Host '  [v] Login probe ............ OK  (role=' $r.user.role ')' -ForegroundColor Green } else { Write-Host '  [X] Login returned no token' -ForegroundColor Red } } catch { Write-Host ('  [X] Login probe ............ FAIL: ' + $_.Exception.Message) -ForegroundColor Red }"

REM ────────────────────────────────────────────────────────────────
REM Summary + advice
REM ────────────────────────────────────────────────────────────────
echo.
echo ============================================================
if !FAILED! GTR 0 (
  echo   !FAILED! check(s) failed. To fix:
  echo     1^) Close any running ParkSphere terminal ^(Ctrl+C^).
  echo     2^) Run start.bat  ^(it auto-installs / seeds anything missing^).
  echo     3^) Run doctor.bat again to verify.
) else (
  echo   All file/toolchain checks passed.
  echo   If the API/Web probes above failed, just run start.bat.
)
echo ============================================================
echo.
pause
exit /b !FAILED!


REM =============================================================================
:report_ok
echo   [v] %~1 ...... %~2
exit /b 0

:report_fail
echo   [X] %~1 ...... %~2
set /a FAILED+=1
exit /b 0

:http_check
REM %1=label, %2=url
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -Uri '%~2' -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop; Write-Host ('  [v] %~1 ........ ' + $r.StatusCode + ' OK') -ForegroundColor Green } catch { Write-Host ('  [X] %~1 ........ unreachable (' + $_.Exception.Message + ')') -ForegroundColor Red; exit 1 }"
if errorlevel 1 set /a FAILED+=1
exit /b 0
