@echo off
echo Cleaning up ports and processes...

REM Kill processes on port 5000 (Backend API)
echo Checking port 5000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING') do (
    echo Killing process %%a on port 5000
    taskkill /F /PID %%a >nul 2>&1
)

REM Kill processes on port 3000 (Frontend)
echo Checking port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    echo Killing process %%a on port 3000
    taskkill /F /PID %%a >nul 2>&1
)

REM Kill any Node.js processes that might be stuck
echo Checking for stuck Node.js processes...
taskkill /F /IM node.exe >nul 2>&1

REM Clean up Prisma client if exists
if exist backend\node_modules\.prisma (
    echo Cleaning up Prisma client...
    rmdir /s /q backend\node_modules\.prisma >nul 2>&1
)

echo.
echo Cleanup completed!
echo You can now run start-dev.bat
pause