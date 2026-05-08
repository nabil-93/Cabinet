@echo off
title ClinicOS - Infos
color 0F
cls

echo.
echo  ████████████████████████████████████████████████████
echo.
echo     ██████╗██╗     ██╗███╗   ██╗██╗ ██████╗
echo    ██╔════╝██║     ██║████╗  ██║██║██╔════╝
echo    ██║     ██║     ██║██╔██╗ ██║██║██║
echo    ██║     ██║     ██║██║╚██╗██║██║██║
echo    ╚██████╗███████╗██║██║ ╚████║██║╚██████╗
echo     ╚═════╝╚══════╝╚═╝╚═╝  ╚═══╝╚═╝ ╚═════╝
echo.
echo  ████████████████████████████████████████████████████
echo.
echo  URLS:
echo  -----------------------------------------------
echo   Frontend:  http://localhost:3000
echo   Backend:   http://localhost:8080/api/v1
echo   Database:  localhost:5432 (clinicos_db)
echo.
echo  CONNEXION DEMO:
echo  -----------------------------------------------
echo   Medecin:    doctor@clinicos.ma   / doctor123
echo   Admin:      admin@clinicos.ma    / admin123
echo.
echo  SCRIPTS DISPONIBLES:
echo  -----------------------------------------------
echo   INSTALLER DEPENDANCES  - A faire UNE seule fois
echo   FRONTEND SEULEMENT     - Pour tester sans backend
echo   START BACKEND (Docker) - Demarre la base de donnees
echo   START TOUT             - Lance tout automatiquement
echo   STOP TOUT              - Arrete tous les services
echo.
echo  TECHNOLOGIE:
echo  -----------------------------------------------
echo   Frontend:  Next.js 16 + React + Tailwind + Framer Motion
echo   Backend:   Spring Boot 3.3 + Java 21 + PostgreSQL
echo   Auth:      JWT Tokens
echo   IA:        OpenAI GPT-4o Mini (ou mode demo sans cle)
echo.
echo  ████████████████████████████████████████████████████
echo.
pause
