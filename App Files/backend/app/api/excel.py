"""FastAPI routes for the Excel-driven dashboard.

All routes are read-only; the workbook is treated as the source of truth and
this layer simply exposes it as JSON the frontend can consume. The reader is
cached in memory and auto-invalidates when the workbook's mtime changes.

Endpoints:
  GET  /api/excel/health              workbook path + last-modified + load info
  GET  /api/excel/dashboard           full landing-page payload
  GET  /api/excel/contractors         contractor rollups
  GET  /api/excel/workers             all workers with their cert statuses
  GET  /api/excel/workers/{name}      single worker (URL-encoded name)
  GET  /api/excel/certifications      cert catalog
  POST /api/excel/refresh             force reload from disk
"""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.encoders import jsonable_encoder

from ..services import excel_reader

router = APIRouter(prefix="/api/excel", tags=["excel"])


# --- Path resolution ---------------------------------------------------------

# This file: App Files/backend/app/api/excel.py
# parents[0]=api, [1]=app, [2]=backend, [3]=App Files, [4]=jacobdashboard
_CERT_TRACKER_DIR = Path(__file__).resolve().parents[4] / "cert_tracker"

_PRIMARY_WORKBOOK_NAME = "Contractor Certifications Tracker.xlsx"
_FALLBACK_WORKBOOK_NAME = "Contractor Certifications Tracker Demo.xlsx"


def _resolve_workbook_path() -> Path:
    """Pick the live workbook if present, fall back to the demo workbook.

    Returns the live path even when missing, so /health can report it instead
    of failing during module import.
    """
    primary = _CERT_TRACKER_DIR / _PRIMARY_WORKBOOK_NAME
    if primary.exists():
        return primary
    fallback = _CERT_TRACKER_DIR / _FALLBACK_WORKBOOK_NAME
    if fallback.exists():
        return fallback
    return primary


_cache = excel_reader.WorkbookCache(_resolve_workbook_path)


def _get_workbook(force: bool = False) -> excel_reader.ParsedWorkbook:
    try:
        return _cache.get(force=force)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except PermissionError as exc:
        # 423 Locked — the workbook is currently open in Excel.
        raise HTTPException(status_code=423, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:  # pragma: no cover  (defensive)
        raise HTTPException(status_code=500, detail=f"Failed to read workbook: {exc}")


# --- Endpoints ---------------------------------------------------------------

@router.get("/health")
def health() -> dict:
    return _cache.health()


@router.get("/dashboard")
def dashboard() -> dict:
    wb = _get_workbook()
    return {
        "kpis": jsonable_encoder(wb.kpis),
        "action_list": jsonable_encoder(wb.action_list),
        "contractors": jsonable_encoder(wb.contractors),
        "heatmap": jsonable_encoder(wb.heatmap),
        "cert_demand": jsonable_encoder(wb.cert_demand),
        "today": wb.today.isoformat(),
        "issues": wb.issues,
        "workbook": {
            "path": wb.workbook_path,
            "last_modified": wb.last_modified.isoformat(),
            "loaded_at": wb.loaded_at.isoformat(),
        },
    }


@router.get("/contractors")
def contractors() -> list[dict]:
    wb = _get_workbook()
    return jsonable_encoder(wb.contractors)


@router.get("/workers")
def workers() -> list[dict]:
    wb = _get_workbook()
    return jsonable_encoder(wb.workers)


@router.get("/workers/{worker_name}")
def worker(worker_name: str) -> dict:
    wb = _get_workbook()
    target = excel_reader._normalize(worker_name)
    for w in wb.workers:
        if excel_reader._normalize(w.name) == target:
            return jsonable_encoder(w)
    raise HTTPException(status_code=404, detail=f"Worker not found: {worker_name}")


@router.get("/certifications")
def certifications() -> list[dict]:
    wb = _get_workbook()
    return jsonable_encoder(wb.certs)


@router.post("/refresh")
def refresh() -> dict:
    wb = _get_workbook(force=True)
    return {
        "ok": True,
        "loaded_at": wb.loaded_at.isoformat(),
        "last_modified": wb.last_modified.isoformat(),
        "kpis": jsonable_encoder(wb.kpis),
    }
