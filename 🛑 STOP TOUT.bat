@echo off
title ClinicOS - Arret
color 0C
cls

echo.
echo  ============================================
echo     ClinicOS - Arret de tous les services
echo  ============================================
echo.

:: Arreter Docker
echo  [1/2] Arret du backend (Docker)...
cd /d "%~dp0clinicos-backend"
docker-compose down 2>nul
echo  [OK] Backend arrete

:: Tuer les processus Node.js sur le port 3000
echo  [2/2] Arret du frontend (port 3000)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000"') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo  [OK] Frontend arrete

echo.
echo  [OK] Tous les services sont arretes.
echo  ============================================
echo.
pause
