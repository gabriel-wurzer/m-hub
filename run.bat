@echo off

REM -------- Environment check --------
IF NOT EXIST .env (
  echo [FEHLER] .env fehlt. hint: Kopiere .env.example und benenne es zu .env um.
  GOTO ENDSCRIPT
)

REM -------- Platform detection (arm64) --------
FOR /F "tokens=2 delims==" %%i IN ('wmic os get osarchitecture /value ^| find "="') DO SET ARCH=%%i

IF "%ARCH%"=="64-bit" (
    REM Most likely amd64, leave DOCKER_PLATFORM unset
) ELSE (
    echo [INFO] ARM64 Windows detected – forcing DOCKER_PLATFORM=linux/amd64 for PostGIS image
    SET DOCKER_PLATFORM=linux/amd64
)

docker 1>NUL 2>NUL
IF NOT %ERRORLEVEL% == 0 echo [FEHLER] docker ist derzeit nicht installiert. hint: https://www.docker.com/products/docker-desktop & GOTO ENDSCRIPT
echo [OK] docker gefunden

docker info 1>NUL 2>NUL
IF NOT %ERRORLEVEL% == 0 echo [FEHLER] docker ist derzeit nicht gestartet. hint: docker desktop starten & GOTO ENDSCRIPT
echo [OK] docker ist gestartet

cmd /c "npm version > npm.ver 2>&1"
for /f %%a in ('type npm.ver ^| find /c /i "err"') do set err=%%a
del npm.ver /f /q
if "%err%" GTR "0" echo [FEHLER] npm ist derzeit nicht installiert. hint: https://nodejs.org/en/download/prebuilt-binaries & GOTO ENDSCRIPT
echo [OK] npm gefunden

cmd /c "ng version > ng.ver 2>&1"
for /f %%a in ('type ng.ver ^| find /c /i "err"') do set err=%%a
del ng.ver /f /q
if "%err%" GTR "0" echo [FEHLER] ng ist derzeit nicht installiert. hint: npm install -g @angular/cli & GOTO ENDSCRIPT
echo [OK] ng gefunden
echo.
echo [INSTALL] Backend... 
cmd /c "cd m-hub-backend/data & npm install --legacy-peer-deps 2>&1" 

echo [INSTALL] Frontend... 
cmd /c "cd m-hub-frontend & npm install 2>&1" 
cmd /c "cd m-hub-frontend & ng build 2>&1"

echo [CLEANUP] Remove old containers and volumes...
docker compose down -v --remove-orphans

echo [START] Postgres database...
docker compose up --build -d m-hub-db

echo [WAIT] Waiting for Postgres database to be ready...
docker compose exec -T m-hub-db sh -c "until pg_isready -U $POSTGRES_USER -d $POSTGRES_DB; do sleep 2; done"
if %ERRORLEVEL% NEQ 0 (
  echo [FEHLER] Postgres did not become ready. See logs:
  docker compose logs --tail 200 m-hub-db
  GOTO ENDSCRIPT
)
echo [OK] Postgres accepting connections.

echo [IMPORT] GeoPackage into Postgres database...
docker compose run --rm gdal
if %ERRORLEVEL% NEQ 0 (
    echo [FEHLER] Datenimport fehlgeschlagen mit exit code %rc%.
    GOTO ENDSCRIPT
)
echo [OK] GeoPackage import finished.

echo [START] Backend, Frontend and Postgis-API...
docker compose up --build m-hub-postgis-api m-hub-backend m-hub-frontend

:ENDSCRIPT
