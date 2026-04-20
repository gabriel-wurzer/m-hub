@echo off

REM -------- Environment check --------
IF NOT EXIST .env (
  echo [FEHLER] .env fehlt. hint: Kopiere .env.example und benenne es zu .env um.
  GOTO ENDSCRIPT
)

REM -------- Platform detection (arm64) --------
IF /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" (
    echo [INFO] ARM64 Windows detected - forcing DOCKER_PLATFORM=linux/amd64 for PostGIS image
    SET DOCKER_PLATFORM=linux/amd64
) ELSE (
    REM amd64 / x86: leave DOCKER_PLATFORM unset
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
pushd m-hub-backend\data
call npm install --legacy-peer-deps
set RC=%ERRORLEVEL%
popd
if not "%RC%"=="0" (
  echo [FEHLER] npm install fehlgeschlagen im Backend - exit code %RC%
  goto ENDSCRIPT
)

echo [INSTALL] Frontend...
pushd m-hub-frontend
call npm install
set RC=%ERRORLEVEL%
popd
if not "%RC%"=="0" (
  echo [FEHLER] npm install fehlgeschlagen im Frontend - exit code %RC%
  goto ENDSCRIPT
)

IF NOT EXIST "m-hub-frontend\src\environments\environment.ts" (
  IF EXIST "m-hub-frontend\src\environments\environment.template.ts" (
    echo [INIT] environment.ts fehlt - kopiere aus environment.template.ts
    copy /Y "m-hub-frontend\src\environments\environment.template.ts" "m-hub-frontend\src\environments\environment.ts" >NUL
    echo [HINWEIS] Passe m-hub-frontend\src\environments\environment.ts an ^(z.B. mapboxToken^) und starte danach neu.
  ) ELSE (
    echo [FEHLER] Weder environment.ts noch environment.template.ts vorhanden in m-hub-frontend\src\environments.
    GOTO ENDSCRIPT
  )
)

echo [BUILD] Frontend - ng build...
pushd m-hub-frontend
call npm run build
set RC=%ERRORLEVEL%
popd
if not "%RC%"=="0" (
  echo [FEHLER] ng build fehlgeschlagen im Frontend - exit code %RC%
  goto ENDSCRIPT
)

IF NOT EXIST "m-hub-frontend\dist\m-hub-frontend\browser" (
  echo [FEHLER] Build-Ausgabe nicht gefunden: m-hub-frontend\dist\m-hub-frontend\browser
  echo         Docker compose erwartet dieses Verzeichnis (siehe m-hub-frontend\Dockerfile).
  GOTO ENDSCRIPT
)
echo [OK] Frontend build output vorhanden.

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

echo [START] Backend, Frontend, Postgis-API and SeaweedFS...
docker compose up --build seaweed-filer m-hub-postgis-api m-hub-backend m-hub-frontend

:ENDSCRIPT
