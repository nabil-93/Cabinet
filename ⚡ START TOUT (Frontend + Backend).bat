@echo off
title ClinicOS - Lancement Complet
color 0E
cls

echo.
echo  ████████████████████████████████████████████
echo     ClinicOS - Lancement Automatique
echo  ████████████████████████████████████████████
echo.
echo  Ce script va ouvrir 2 fenetres:
echo    1 - Frontend  (http://localhost:3000)
echo    2 - Backend   (http://localhost:8080)
echo.
echo  Attendre 30 secondes apres le lancement
echo  avant d'ouvrir le navigateur.
echo  ████████████████████████████████████████████
echo.
pause

:: Ouvrir le frontend dans une nouvelle fenetre
echo  [1/2] Demarrage du frontend...
start "ClinicOS Frontend" cmd /k "cd /d "%~dp0clinicos" && npm run dev"

:: Attendre 3 secondes
timeout /t 3 /nobreak >nul

:: Ouvrir le backend dans une nouvelle fenetre
echo  [2/2] Demarrage du backend (Docker)...
start "ClinicOS Backend" cmd /k "cd /d "%~dp0clinicos-backend" && docker-compose up --build"

:: Attendre que tout demarre
echo.
echo  [*] Attente du demarrage (30 secondes)...
timeout /t 30 /nobreak

:: Ouvrir le navigateur
echo.
echo  [*] Ouverture du navigateur...
start "" "http://localhost:3000"

echo.
echo  ============================================
echo   ClinicOS est maintenant en cours d'execution!
echo.
echo   Frontend:  http://localhost:3000
echo   Backend:   http://localhost:8080/api/v1
echo.
echo   Email:    doctor@clinicos.ma
echo   Password: doctor123
echo  ============================================
echo.
pause
