@echo off
title Backend FastAPI Server
echo ======================================================
echo   Starting Backend FastAPI (Uvicorn)
echo ======================================================
cd /d "%~dp0"

if not exist .venv (
    echo [Virtual environment belum ada. Membuat .venv...]
    python -m venv .venv
    call .venv\Scripts\activate
    echo [Menginstall dependencies Python...]
    pip install -r requirements.txt
) else (
    call .venv\Scripts\activate
)

echo.
echo [SERVER READY] Backend running at http://localhost:8000
echo [SWAGGER DOCS] http://localhost:8000/docs
echo.
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
pause

