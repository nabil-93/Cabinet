@echo off
title ClinicOS - Frontend
color 0B
cls

echo.
echo  ============================================
echo     CLINICOS - FRONTEND (Next.js)
echo  ============================================
echo.
echo  [*] Demarrage du frontend...
echo  [*] URL: http://localhost:3000
echo.
echo  Appuie sur CTRL+C pour arreter
echo  ============================================
echo.

cd /d "%~dp0clinicos"

:: Verifier si node_modules existe
if not exist "node_modules" (
    echo  [!] Installation des dependances...
    call npm install
    echo.
)

:: Demarrer le serveur
call npm run dev

pause
