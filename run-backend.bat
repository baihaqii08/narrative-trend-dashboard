@echo off
title Backend FastAPI Server (MBG Narrative Trend)
echo ======================================================
echo   Starting Backend FastAPI (Uvicorn)
echo ======================================================
cd /d "%~dp0backend"

if exist .venv\Scripts\activate.bat (
    call .venv\Scripts\activate.bat
    python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
) else if exist ..\.venv\Scripts\activate.bat (
    call ..\.venv\Scripts\activate.bat
    python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
) else (
    echo [.venv tidak ditemukan. Menjalankan python sistem...]
    python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
)
pause
