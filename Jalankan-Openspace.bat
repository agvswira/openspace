@echo off
rem Openspace - jalankan aplikasi dengan klik dua kali (Windows).
rem Instalasi pertama otomatis (butuh internet), lalu browser terbuka di http://localhost:5180
setlocal
cd /d "%~dp0"
title Openspace

where node >nul 2>nul
if errorlevel 1 goto :nonode

if not exist "node_modules\" goto :setup
if not exist "backend\node_modules\" goto :setup
if not exist "frontend\node_modules\" goto :setup
goto :run

:setup
echo [Openspace] Instalasi pertama, mohon tunggu beberapa menit...
call npm run setup
if errorlevel 1 goto :fail

:run
echo [Openspace] Menjalankan aplikasi. Tutup jendela ini (atau tekan Ctrl+C) untuk berhenti.
echo [Openspace] Akun demo: nata@openspace.example / password123
start "" /min cmd /c "timeout /t 15 /nobreak >nul & start http://localhost:5180"
call npm run dev
goto :eof

:nonode
echo Node.js belum terpasang.
echo Unduh versi LTS di https://nodejs.org lalu jalankan file ini lagi.
pause
exit /b 1

:fail
echo Instalasi gagal. Periksa koneksi internet lalu jalankan file ini lagi.
pause
exit /b 1
