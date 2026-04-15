# Jacob Workforce Dashboard

A local desktop-ready dashboard for tracking companies, workers, certifications, uploads, and custom report charts without relying on spreadsheets.

## What is included

- React + TypeScript frontend with a modern dashboard layout
- FastAPI + SQLite backend
- Company-separated views
- Worker management
- Certification uploads for PDFs and images
- Smart certification field suggestions from uploaded files
- Expiration-aware analytics
- Report Studio for custom grouped charts
- CSV exports for workers and certifications
- Seeded demo data so the app is usable immediately
- Python desktop launcher with `pywebview`
- Linux desktop packaging with `PyInstaller`

## Project structure

- [backend/app/main.py](/home/joshua-santiago/jacobdashboard/backend/app/main.py)
- [backend/app/desktop.py](/home/joshua-santiago/jacobdashboard/backend/app/desktop.py)
- [frontend/src/App.tsx](/home/joshua-santiago/jacobdashboard/frontend/src/App.tsx)
- [launch_dashboard.py](/home/joshua-santiago/jacobdashboard/launch_dashboard.py)

## First-time setup

### Ubuntu / Linux

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements.txt
cd frontend
npm install
cd ..
```

### Windows PowerShell

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
cd frontend
npm install
cd ..
```

## Run in development mode

### Terminal 1

```bash
. .venv/bin/activate
cd backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8124
```

### Terminal 2

```bash
cd frontend
npm run dev
```

Open `http://127.0.0.1:5173`.

## Run as a local desktop app

Build the frontend once, then launch the desktop wrapper:

```bash
. .venv/bin/activate
python launch_dashboard.py
```

The launcher will build the frontend automatically if `frontend/dist` does not exist yet.

## Build a desktop executable

From the project root:

```bash
. .venv/bin/activate
python build_desktop.py
```

That creates a packaged Linux desktop app in `dist/JacobWorkforceDashboard/`.

## Local data

- SQLite database: `backend/data/workforce_dashboard.db`
- Uploaded files: `backend/data/uploads/`

## Notes

- The app seeds a starter dataset only when the database is empty.
- Certification uploads support PDFs and images.
- PDF uploads can suggest title, contractor, and dates automatically when readable text or useful filenames are available.
- Export buttons in the Certifications page download CSVs for workers and certifications inside the current company scope.
- Demo certification rows intentionally do not point to real files, so “Open file” appears only for files you upload yourself.
- `pywebview` on Linux may require WebKit or GTK packages if they are not already installed on the system.
- This project also includes the Qt backend (`QtPy` + `PyQt5`) so the packaged desktop app can run without depending only on GTK bindings.
