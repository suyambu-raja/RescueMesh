@echo off
echo ============================================
echo   RapidRescue Backend Server
echo ============================================
echo.

cd /d "%~dp0"

:: Create venv if it doesn't exist
if not exist "venv" (
    echo [1/3] Creating virtual environment...
    py -3.12 -m venv venv
)

:: Activate venv
call venv\Scripts\activate.bat

:: Install dependencies
echo [2/3] Installing dependencies...
pip install -r requirements.txt -q

:: Run server
echo [3/3] Starting FastAPI server...
echo.
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
