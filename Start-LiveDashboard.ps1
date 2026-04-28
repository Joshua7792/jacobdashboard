$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = Join-Path $Root "App Files"
$BackendDir = Join-Path $AppDir "backend"
$FrontendDir = Join-Path $AppDir "frontend"
$VenvPython = Join-Path $AppDir ".venv\Scripts\python.exe"
$Requirements = Join-Path $BackendDir "requirements.txt"
$NodeModules = Join-Path $FrontendDir "node_modules"
$LiveUrl = "http://127.0.0.1:5173/"

function Test-PortListening {
    param([int]$Port)

    $connection = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1
    return $null -ne $connection
}

function Quote-PowerShellPath {
    param([string]$Path)
    return "'" + $Path.Replace("'", "''") + "'"
}

Write-Host ""
Write-Host "Starting live dashboard workflow..."
Write-Host ""

if (-not (Test-Path $VenvPython)) {
    Write-Host "Creating Python environment..."
    Push-Location $AppDir
    python -m venv .venv
    & $VenvPython -m pip install -r $Requirements
    Pop-Location
}

if (-not (Test-Path $NodeModules)) {
    Write-Host "Installing frontend packages..."
    Push-Location $FrontendDir
    npm install
    Pop-Location
}

if (-not (Test-PortListening 8124)) {
    $backendCommand = "Set-Location $(Quote-PowerShellPath $BackendDir); ..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8124"
    Start-Process powershell -ArgumentList @("-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $backendCommand)
    Write-Host "Backend live reload started on http://127.0.0.1:8124"
} else {
    Write-Host "Backend is already running on http://127.0.0.1:8124"
}

if (-not (Test-PortListening 5173)) {
    $frontendCommand = "Set-Location $(Quote-PowerShellPath $FrontendDir); npm run dev -- --host 127.0.0.1"
    Start-Process powershell -ArgumentList @("-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $frontendCommand)
    Write-Host "Frontend hot reload started on $LiveUrl"
} else {
    Write-Host "Frontend is already running on $LiveUrl"
}

$codeCommand = Get-Command code -ErrorAction SilentlyContinue
if ($codeCommand) {
    Start-Process -FilePath $codeCommand.Source -ArgumentList "`"$Root`""
    Write-Host "Opened this project in VS Code."
}

Start-Sleep -Seconds 2
Start-Process $LiveUrl

Write-Host ""
Write-Host "Use the browser at $LiveUrl while editing in VS Code."
Write-Host "Frontend changes hot-reload automatically. Backend changes restart automatically."
Write-Host ""
