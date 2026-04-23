@echo off
REM Drag a certification PDF onto this file to import it into the Excel tracker.
REM You can also drop multiple PDFs at once.

setlocal
cd /d "%~dp0"

if "%~1"=="" (
    echo.
    echo Drag one or more PDF files onto this .bat file to import them.
    echo.
    pause
    exit /b 1
)

python scripts\import_pdf.py %*
echo.
echo ----------------------------------------
pause
endlocal
