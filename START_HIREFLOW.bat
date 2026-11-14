@echo off
setlocal enabledelayedexpansion
title HireFlow - Chhatrapati Shivaji’s Creative Solutions Recruitment Desk
color 0A

echo =====================================================================
echo      CHHATRAPATI SHIVAJI’S CREATIVE SOLUTIONS - HIREFLOW DESK       
echo =====================================================================
echo.

:: 1. Terminate any stale process on port 3000
echo [1/5] Checking port 3000 for previous instances...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
  echo Freeing port 3000 (Process ID: %%a)...
  taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

:: 2. Verify Node.js and npm
echo [2/5] Verifying Node.js runtime...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Node.js is not found. Please install Node.js from https://nodejs.org
  pause
  exit /b 1
)

:: 3. 14-Day Rotating Daily Backup of Database
echo [3/5] Performing daily rotating backup...
if not exist "data\backups" mkdir "data\backups"

for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set CURR_DATE=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%
if exist "data\hireflow_db.json" (
  copy /Y "data\hireflow_db.json" "data\backups\hireflow_db_%CURR_DATE%.json" >nul
  echo Daily backup saved: data\backups\hireflow_db_%CURR_DATE%.json
)

:: Purge backups older than 14 days
for /f "skip=14 delims=" %%F in ('dir /b /o-d "data\backups\hireflow_db_*.json" 2^>nul') do (
  del "data\backups\%%F" >nul 2>&1
)

:: 4. Verify Next.js Build
echo [4/5] Checking application build...
if not exist ".next" (
  echo Fresh build required. Running npm run build...
  call npm run build
  if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build failed. Please check logs.
    pause
    exit /b 1
  )
)

:: 5. Launch Server and Open Browser
echo [5/5] Starting HireFlow on http://localhost:3000...
echo.
echo Application is starting. Please keep this window open while using HireFlow.
echo Press Ctrl+C or run STOP_HIREFLOW.bat to shut down.
echo.

:: Launch browser in background after short delay
start /b cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"

:: Start the Next.js production server
call npm start

pause

