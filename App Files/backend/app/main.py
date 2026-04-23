from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .api import companies, contractors, dashboard, exports, lookups, reports, training, workers
from .database import BASE_DIR, Base, UPLOAD_DIR, engine, ensure_schema, session_scope
from .seed import ensure_default_contractors, ensure_project_company, ensure_training_catalog, migrate_legacy_training_data

if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
    FRONTEND_DIST = Path(sys._MEIPASS) / "frontend" / "dist"
else:
    FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_schema()
    with session_scope() as session:
        project = ensure_project_company(session)
        ensure_default_contractors(session, project.id)
        ensure_training_catalog(session)
        migrate_legacy_training_data(session)
    yield


app = FastAPI(title="Cordillera Workforce Dashboard", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(companies.router, prefix="/api")
app.include_router(contractors.router, prefix="/api")
app.include_router(workers.router, prefix="/api")
app.include_router(training.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(exports.router, prefix="/api")
app.include_router(lookups.router, prefix="/api")
app.include_router(reports.router, prefix="/api")

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api")
def api_root():
    return {"message": "Cordillera Workforce Dashboard API"}


if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="frontend-assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        requested_file = FRONTEND_DIST / full_path
        if full_path and requested_file.exists() and requested_file.is_file():
            return FileResponse(requested_file)
        index_file = FRONTEND_DIST / "index.html"
        return FileResponse(index_file)
else:

    @app.get("/{full_path:path}")
    def dev_hint(full_path: str):
        return JSONResponse(
            {
                "message": "Frontend build not found yet.",
                "next_steps": [
                    "Run the React frontend with npm run dev inside frontend.",
                    "Or build it with npm run build inside frontend, then reopen the desktop launcher.",
                ],
            }
        )
