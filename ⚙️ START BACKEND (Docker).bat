@echo off
title ClinicOS - Backend + Database
color 0A
cls

echo.
echo  ============================================
echo     CLINICOS - BACKEND (Spring Boot + DB)
echo  ============================================
echo.
echo  [*] Demarrage avec Docker...
echo  [*] API: http://localhost:8080/api/v1
echo  [*] DB PostgreSQL: localhost:5432
echo.
echo  Appuie sur CTRL+C pour arreter
echo  ============================================
echo.

cd /d "%~dp0clinicos-backend"

:: Verifier si Docker est installe
docker --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [ERREUR] Docker n'est pas installe ou pas demarre!
    echo.
    echo  Telecharge Docker Desktop: https://www.docker.com/products/docker-desktop
    echo.
    pause
    exit
)

:: Demarrer avec docker-compose
echo  [*] Lancement de la base de donnees + backend...
echo.
docker-compose up --build

pause
