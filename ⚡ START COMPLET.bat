@echo off
title ClinicOS - Demarrage Complet
color 0E
cls

echo.
echo  ████████████████████████████████████████████████████
echo     ClinicOS - Frontend + Backend
echo  ████████████████████████████████████████████████████
echo.
echo  Ce script lance tout en 2 fenetres separees.
echo.
echo  !! Premiere fois: 3-5 min pour le backend !!
echo     (telechargement des dependances Java)
echo.
echo  Appuie sur une touche pour commencer...
pause >nul

:: ── 1. Backend ──
echo  [1/2] Lancement du Backend...
start "ClinicOS - Backend" cmd /k "title ClinicOS Backend && cd /d "%~dp0" && call "⚙️ START BACKEND.bat""

:: Attendre un peu
timeout /t 4 /nobreak >nul

:: ── 2. Frontend ──
echo  [2/2] Lancement du Frontend...
start "ClinicOS - Frontend" cmd /k "title ClinicOS Frontend && cd /d "%~dp0clinicos" && npm run dev"

echo.
echo  ========================================================
echo   Les 2 serveurs demarrent...
echo.
echo   - Backend:  http://localhost:8080/api/v1
echo   - Frontend: http://localhost:3000
echo.
echo   Attends ~35 secondes puis ouvre: http://localhost:3000
echo.
echo   Login: doctor@clinicos.ma / doctor123
echo  ========================================================
echo.

timeout /t 40 /nobreak

echo  [*] Ouverture automatique du navigateur...
start "" "http://localhost:3000"

pause
