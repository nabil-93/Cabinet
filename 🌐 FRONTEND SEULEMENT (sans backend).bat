@echo off
title ClinicOS - Frontend (Mode Demo)
color 0B
cls

echo.
echo  ████████████████████████████████████████████
echo     ClinicOS - MODE DEMO (Frontend seul)
echo  ████████████████████████████████████████████
echo.
echo  Lance le frontend SANS le backend.
echo  Les donnees affichees seront des donnees
echo  de demonstration (mock data).
echo.
echo  URL: http://localhost:3000
echo  ████████████████████████████████████████████
echo.

cd /d "%~dp0clinicos"

:: Verifier node_modules
if not exist "node_modules" (
    echo  [!] Premiere installation - patientez...
    call npm install
    echo.
)

:: Attendre 2 secondes puis ouvrir le navigateur
start "" /b timeout /t 5 /nobreak >nul && start "" "http://localhost:3000"

:: Demarrer Next.js
echo  [*] Demarrage...
echo.
call npm run dev

pause
