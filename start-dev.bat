@echo off
echo Starting WhatsApp Bot Backend with Workers...

REM Check if Docker is running
docker version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)

REM Kill processes using our ports
echo Cleaning up ports...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

REM Stop any existing containers
echo Cleaning up existing containers...
docker compose down --remove-orphans >nul 2>&1

REM Start Docker containers
echo Starting PostgreSQL and Redis...
docker compose up -d

REM Wait for PostgreSQL to be ready
echo Waiting for PostgreSQL to be ready...
set max_attempts=30
set attempt=0

:wait_postgres
docker compose exec -T postgres pg_isready -U postgres >nul 2>&1
if %errorlevel% equ 0 goto postgres_ready

set /a attempt+=1
if %attempt% geq %max_attempts% (
    echo ERROR: PostgreSQL failed to start after %max_attempts% attempts
    echo Try running: docker compose logs postgres
    pause
    exit /b 1
)

timeout /t 1 /nobreak >nul
goto wait_postgres

:postgres_ready
echo PostgreSQL is ready!

REM Wait for Redis to be ready
echo Waiting for Redis to be ready...
set max_attempts=15
set attempt=0

:wait_redis
docker compose exec -T redis redis-cli ping >nul 2>&1
if %errorlevel% equ 0 goto redis_ready

set /a attempt+=1
if %attempt% geq %max_attempts% (
    echo WARNING: Redis not ready, but continuing (system will work without Redis)
    goto continue_setup
)

timeout /t 1 /nobreak >nul
goto wait_redis

:redis_ready
echo Redis is ready!

:continue_setup
REM Navigate to backend directory
cd backend

REM Check if .env exists
if not exist .env (
    if exist .env.local (
        echo Copying .env.local to .env...
        copy .env.local .env >nul
    ) else if exist .env.example (
        echo Creating .env from .env.example...
        copy .env.example .env >nul
        echo.
        echo IMPORTANT: You must configure backend\.env with your credentials
        echo See QUICK_START.md for detailed instructions
        pause
        exit /b 1
    )
)

REM Install dependencies if needed
if not exist node_modules (
    echo Installing backend dependencies...
    call npm install
)

REM Generate Prisma client
echo Generating Prisma client...
REM Try to delete old Prisma client to avoid permission issues
if exist node_modules\.prisma (
    rmdir /s /q node_modules\.prisma >nul 2>&1
)
call npm run generate
if errorlevel 1 (
    echo WARNING: Prisma client generation had issues, retrying...
    timeout /t 2 /nobreak >nul
    call npm run generate
)

REM Check if migrations exist
echo Checking database migrations...
if exist prisma\migrations (
    echo Applying existing migrations...
    call npx prisma migrate deploy
    if errorlevel 1 (
        echo.
        echo ERROR: Failed to apply migrations
        echo Try running manually: cd backend ^&^& npm run migrate:dev
        pause
        exit /b 1
    )
) else (
    echo.
    echo No migrations found. Creating initial migration...
    call npx prisma migrate dev --name initial_setup
    if errorlevel 1 (
        echo.
        echo ERROR: Failed to create initial migration
        echo Make sure PostgreSQL is running and accessible
        pause
        exit /b 1
    )
)

REM Check frontend
if exist ..\frontend-app\package.json (
    cd ..\frontend-app
    if not exist node_modules (
        echo Installing frontend dependencies...
        call npm install
    )
    cd ..\backend
)

REM Start services in new windows
echo.
echo Starting services...

REM Start API server
echo Starting API server...
start "WhatsApp Bot API" cmd /k npm run dev

REM Wait a bit for API to start
timeout /t 3 /nobreak >nul

REM Start worker
echo Starting message worker...
start "WhatsApp Bot Worker" cmd /k npm run dev:worker

REM Start frontend if exists
if exist ..\frontend-app\package.json (
    echo Starting frontend...
    cd ..\frontend-app
    start "WhatsApp Bot Frontend" cmd /k npm run dev
    cd ..\backend
)

REM Display information
echo.
echo ===================================================
echo Services started successfully!
echo ===================================================
echo Backend API:  http://localhost:5000
echo Worker:       Processing messages in background
if exist ..\frontend-app\package.json (
    echo Frontend:     http://localhost:3000
)
echo.
echo Additional tools:
echo - Prisma Studio: cd backend ^&^& npx prisma studio
echo - Docker logs:   docker compose logs -f
echo.
echo To connect WhatsApp:
echo 1. In another terminal run: ngrok http 5000
echo 2. Copy the HTTPS URL from ngrok
echo 3. Configure webhook in Meta Developers
echo 4. Send messages to your WhatsApp number!
echo.
echo To stop all services:
echo - Close all command windows
echo - Run: docker compose down
echo ===================================================
echo.
pause