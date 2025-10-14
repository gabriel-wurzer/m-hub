@echo off
docker 1>NUL 2>NUL
IF NOT %ERRORLEVEL% == 0 ECHO [FEHLER] docker ist derzeit nicht installiert. hint: https://www.docker.com/products/docker-desktop & GOTO ENDSCRIPT
ECHO [OK] docker gefunden

docker info 1>NUL 2>NUL
IF NOT %ERRORLEVEL% == 0 ECHO [FEHLER] docker ist derzeit nicht gestartet. hint: docker desktop starten & GOTO ENDSCRIPT
ECHO [OK] docker ist gestartet

cmd /c "npm version > npm.ver 2>&1"
for /f %%a in ('type npm.ver ^| find /c /i "err"') do set err=%%a
del npm.ver /f /q
if "%err%" GTR "0" echo [FEHLER] npm ist derzeit nicht installiert. hint: https://nodejs.org/en/download/prebuilt-binaries & GOTO ENDSCRIPT
ECHO [OK] npm gefunden

cmd /c "ng version > ng.ver 2>&1"
for /f %%a in ('type ng.ver ^| find /c /i "err"') do set err=%%a
del ng.ver /f /q
if "%err%" GTR "0" echo [FEHLER] ng ist derzeit nicht installiert. hint: npm install -g @angular/cli & GOTO ENDSCRIPT
ECHO [OK] ng gefunden
echo.
echo [INSTALL] backend...
cmd /c "cd m-hub-backend/data & npm install --legacy-peer-deps 2>&1"
echo [INSTALL] frontend...
cmd /c "cd m-hub-frontend & npm install 2>&1"
cmd /c "cd m-hub-frontend & ng build 2>&1"

echo [IMPORT] GeoPackage into PostGIS...
docker compose --profile import up --remove-orphans gdal
if %ERRORLEVEL% NEQ 0 GOTO ENDSCRIPT

echo [START] backend and frontend...
docker compose up

:ENDSCRIPT
