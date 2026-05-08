@echo off
title ClinicOS - Backend
color 0A
cls

echo.
echo  ========================================================
echo     CLINICOS - BACKEND (Spring Boot)
echo  ========================================================
echo.

cd /d "%~dp0clinicos-backend"

:: Verifier Java
java -version >nul 2>&1
if errorlevel 1 (
    echo  [ERREUR] Java non detecte!
    echo  Java est deja installe sur cette machine.
    echo  Verifie le PATH ou relance en tant qu'administrateur.
    pause
    exit /b 1
)
echo  [OK] Java detecte

:: Chercher Maven
set MAVEN_DIR=%USERPROFILE%\.clinicos-maven\apache-maven-3.9.6
set MVN_EXE=%MAVEN_DIR%\bin\mvn.cmd

if not exist "%MVN_EXE%" (
    echo.
    echo  [INFO] Maven non detecte. Telechargement automatique...
    echo  (necessite une connexion internet - 1 seule fois)
    echo.

    powershell -ExecutionPolicy Bypass -Command ^
        "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; " ^
        "$url = 'https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.6/apache-maven-3.9.6-bin.zip'; " ^
        "$dest = '$env:TEMP\maven.zip'; " ^
        "Write-Host 'Telechargement...'; " ^
        "Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing; " ^
        "$target = '$env:USERPROFILE\.clinicos-maven'; " ^
        "New-Item -ItemType Directory -Force -Path $target | Out-Null; " ^
        "Write-Host 'Extraction...'; " ^
        "Expand-Archive -Path $dest -DestinationPath $target -Force; " ^
        "Remove-Item $dest; " ^
        "Write-Host 'Maven installe!'"

    if not exist "%MVN_EXE%" (
        echo.
        echo  [ERREUR] Echec du telechargement de Maven.
        echo  Verifie ta connexion internet et reessaie.
        pause
        exit /b 1
    )
    echo  [OK] Maven installe avec succes!
)

echo  [OK] Maven detecte

:: Lancement du backend avec profil DEV (H2 en memoire)
echo.
echo  [*] Demarrage du backend en mode DEV...
echo  [*] Base de donnees: H2 (pas besoin de PostgreSQL)
echo  [*] API: http://localhost:8080/api/v1
echo.
echo  PREMIERE FOIS: attendre 3-5 min (telechargement des libs)
echo  FOIS SUIVANTES: ~30 secondes
echo.
echo  ========================================================
echo.

"%MVN_EXE%" spring-boot:run -Dspring-boot.run.profiles=dev -Dspring.profiles.active=dev

pause
