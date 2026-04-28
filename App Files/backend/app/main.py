"""FastAPI application entry point.

Mounts the read-only Excel API under /api/excel and serves the built React
frontend (when present) so the desktop launcher can package both halves into
a single uvicorn process.

There is no database. The Contractor Certifications Tracker workbook is the
source of truth; ``services.excel_reader`` reads it on demand and caches the
parsed result, auto-invalidating when the workbook's mtime changes.
"""
from __future__ import annotations

from pathlib import Path
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .api import excel

# When packaged with PyInstaller, sys._MEIPASS points at the temp extraction
# dir that holds the bundled frontend assets. In development we resolve the
# path relative to this file: backend/app/main.py -> backend -> App Files.
if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
    FRONTEND_DIST = Path(sys._MEIPASS) / "frontend" / "dist"
else:
    FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


app = FastAPI(title="Cordillera Workforce Dashboard")

# CORS allows the Vite dev server (port 5173) to call the API in development.
# In the packaged desktop build the frontend is served from the same origin,
# so this is only relevant during ``npm run dev``.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# The excel router declares its own ``/api/excel`` prefix internally.
app.include_router(excel.router)


@app.get("/api/health")
def health() -> dict:
    """Simple liveness probe used by the desktop launcher to wait for boot."""
    return {"status": "ok"}


@app.get("/api")
def api_root() -> dict:
    return {"message": "Cordillera Workforce Dashboard API"}


# Serve the built React app. The catch-all route falls back to index.html so
# react-router routes like /actions or /heatmap work after a hard refresh.
if FRONTEND_DIST.exists():
    app.mount(
        "/assets",
        StaticFiles(directory=FRONTEND_DIST / "assets"),
        name="frontend-assets",
    )

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        requested_file = FRONTEND_DIST / full_path
        if full_path and requested_file.exists() and requested_file.is_file():
            return FileResponse(requested_file)
        return FileResponse(FRONTEND_DIST / "index.html")
else:

    @app.get("/{full_path:path}")
    def dev_hint(full_path: str):
        return JSONResponse(
            {
                "message": "Frontend build not found yet.",
                "next_steps": [
                    "Run the React frontend with 'npm run dev' inside frontend.",
                    "Or build it with 'npm run build' inside frontend, then reopen the desktop launcher.",
                ],
            }
        )
