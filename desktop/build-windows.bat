@echo off
setlocal
chcp 65001 >nul
title Crear instalador de RRHH Simple
cd /d "%~dp0"

echo ==================================================
echo   RRHH Simple - Generador del instalador de Windows
echo ==================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js no esta instalado. Intentando instalarlo con winget...
  where winget >nul 2>&1
  if errorlevel 1 goto :nonode
  winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
  echo.
  echo Node.js instalado. CIERRE esta ventana y vuelva a ejecutar build-windows.bat
  pause
  exit /b 0
)
goto :hasnode
:nonode
echo Instale Node.js LTS desde https://nodejs.org y vuelva a ejecutar este archivo.
pause
exit /b 1
:hasnode

echo [1/5] Instalando dependencias del proyecto y compilando la interfaz...
pushd ..
call npm install --ignore-scripts --no-audit --no-fund || goto :fail
call npm run build || goto :fail
popd

echo.
echo [2/5] Copiando la interfaz compilada...
if exist dist rmdir /s /q dist
xcopy /e /i /q "..\dist" "dist" >nul || goto :fail

echo.
echo [3/5] Instalando dependencias de escritorio (Electron)...
call npm install --no-audit --no-fund || goto :fail

echo.
echo [4/5] Preparando PostgreSQL portable...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\prepare-postgres.ps1" || goto :fail

echo.
echo [5/5] Generando el instalador (tarda varios minutos)...
echo Cerrando la compilacion anterior si quedo incompleta...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\prepare-electron-build.ps1" || goto :fail
call npm run dist || goto :fail

echo.
echo ==================================================
echo   LISTO. Instalador en: %~dp0release
echo ==================================================
start "" "%~dp0release"
pause
exit /b 0

:fail
echo.
echo *** ERROR: el proceso se detuvo. Revise el mensaje anterior. ***
pause
exit /b 1
