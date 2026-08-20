@echo off
REM Life Organizer Desktop — roda o app Electron (sem instalar)
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando dependencias (primeira vez)...
  call npm install
)
call npm start