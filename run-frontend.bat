@echo off
title Frontend React Vite Dev Server
echo ======================================================
echo   Starting Frontend React (Vite)
echo ======================================================
cd /d "%~dp0frontend"

if not exist .env (
    echo [.env tidak ditemukan, membuat .env default...]
    copy .env.example .env
)

if not exist node_modules (
    echo [node_modules belum ada. Menginstall packages...]
    call npm install
)

echo.
echo [SERVER READY] Frontend running at http://localhost:5173
echo.
npm run dev
pause
