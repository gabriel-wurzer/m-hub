#!/bin/bash
command -v docker >/dev/null 2>&1 || { echo >&2 "[FEHLER] docker ist derzeit nicht installiert. hint: docker installieren."; exit 1; }
echo [OK] docker gefunden

docker info > /dev/null 2>&1 || { echo >&2 "[FEHLER] docker ist derzeit nicht gestartet. hint: docker starten."; exit 1; }
echo [OK] docker ist gestartet

docker compose > /dev/null 2>&1 || { echo >&2 "[FEHLER] docker compose ist derzeit nicht installiert. hint: docker-compose installieren."; exit 1; }
echo [OK] docker compose funktioniert

command -v npm >/dev/null 2>&1 || { echo >&2 "[FEHLER] npm ist derzeit nicht installiert. hint: nodejs installieren. "; exit 1; }
echo [OK] npm gefunden

command -v ng >/dev/null 2>&1 || { echo >&2 "[FEHLER] ng ist derzeit nicht installiert. hint: npm install -g  @angular/cli"; exit 1; }
echo [OK] ng gefunden

echo >&2 "[INSTALL] backend..."
cd m-hub-backend
cd data
npm install --legacy-peer-deps 2>&1
chown -R 1000:1000 .
cd ..
cd ..

echo [INSTALL] frontend...
cd m-hub-frontend 
npm install 2>&1
ng build 2>&1
cd ..

docker compose up

