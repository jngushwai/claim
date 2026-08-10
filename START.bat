@echo off
title DIT Consultancy Claims System
color 0A
echo.
echo  =====================================================
echo   DIT Consultancy Claim Management System
echo   Dar es Salaam Institute of Technology
echo  =====================================================
echo.

:: ---- BACKEND SETUP ----
if not exist "backend\node_modules" (
  echo [1/4] Installing backend packages (requires internet, one-time only)...
  cd backend
  call npm install --prefer-offline
  echo [2/4] Creating database...
  call node node_modules\prisma\build\index.js db push --skip-generate
  cd ..
) else (
  echo [OK] Backend packages ready
  :: Only push schema if DB does not exist yet
  if not exist "backend\prisma\dit_claims.db" (
    echo [..] Creating database for the first time...
    cd backend
    call node node_modules\prisma\build\index.js db push --skip-generate
    cd ..
  ) else (
    echo [OK] Database ready
  )
)

:: ---- FRONTEND SETUP ----
if not exist "frontend\node_modules" (
  echo [3/4] Installing frontend packages (requires internet, one-time only)...
  cd frontend
  call npm install --prefer-offline
  cd ..
) else (
  echo [OK] Frontend packages ready
)

echo.
echo  =====================================================
echo   Starting servers (no internet required)...
echo   App will open at: http://localhost:5747
echo  =====================================================
echo.
echo  To stop: close the two server windows that open.
echo.

:: Kill any leftover processes on these ports
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3747 " ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":5747 " ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1

timeout /t 1 /nobreak >nul

:: Start backend
start "DIT Backend (port 3747)" cmd /k "cd /d "%~dp0backend" && node src/index.js"

:: Wait for backend to fully start before launching frontend
timeout /t 5 /nobreak >nul
start "DIT Frontend (port 5747)" cmd /k "cd /d "%~dp0frontend" && node node_modules/vite/bin/vite.js --port 5747"

:: Wait for frontend to compile then open browser
timeout /t 8 /nobreak >nul
start http://localhost:5747

echo  System started! Browser opening...
echo.
pause
