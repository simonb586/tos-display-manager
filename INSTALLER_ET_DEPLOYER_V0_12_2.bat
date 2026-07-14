@echo off
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\INSTALLER_ET_DEPLOYER_V0_12_2.ps1"
pause
