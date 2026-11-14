@echo off
title Stop HireFlow
color 0C

echo =====================================================================
echo                STOPPING HIREFLOW RECRUITMENT DESK                     
echo =====================================================================
echo.

set FOUND=0
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
  echo Terminating process %%a on port 3000...
  taskkill /F /PID %%a >nul 2>&1
  set FOUND=1
)

if %FOUND%==1 (
  echo.
  echo [SUCCESS] HireFlow stopped successfully. Port 3000 is now free.
) else (
  echo.
  echo [INFO] No running HireFlow process found on port 3000.
)

echo.
timeout /t 3
exit

