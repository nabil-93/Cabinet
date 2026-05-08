@echo off
title ClinicOS - Installation
color 0D
cls

echo.
echo  ████████████████████████████████████████████
echo     ClinicOS - Installation des dependances
echo  ████████████████████████████████████████████
echo.
echo  Ce script installe tout ce qu'il faut
echo  pour faire tourner ClinicOS.
echo.
echo  Patientez, cela peut prendre 2-3 minutes...
echo  ████████████████████████████████████████████
echo.

:: Verifier Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo  [ERREUR] Node.js n'est pas installe!
    echo  Telecharge sur: https://nodejs.org
    pause
    exit
)

echo  [OK] Node.js detecte
node --version
echo.

:: Installer les dependances frontend
echo  [1/2] Installation du frontend (npm install)...
cd /d "%~dp0clinicos"
call npm install
echo  [OK] Frontend installe!
echo.

:: Verifier Docker pour le backend
docker --version >nul 2>&1
if errorlevel 1 (
    echo  [INFO] Docker non detecte - backend non installe
    echo  Pour le backend, installe Docker Desktop:
    echo  https://www.docker.com/products/docker-desktop
) else (
    echo  [2/2] Telechargement des images Docker...
    cd /d "%~dp0clinicos-backend"
    docker-compose pull
    echo  [OK] Images Docker telechargees!
)

echo.
echo  ████████████████████████████████████████████
echo   Installation terminee!
echo.
echo   Tu peux maintenant lancer:
echo   "FRONTEND SEULEMENT" pour tester rapidement
echo   "START TOUT" pour la version complete
echo  ████████████████████████████████████████████
echo.
pause
