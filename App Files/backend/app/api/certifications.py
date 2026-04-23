from __future__ import annotations

from datetime import date

from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from ..database import UPLOAD_DIR
from ..models import Certification, Contractor, Worker
from ..schemas import CertificationAnalysis, CertificationRead
from ..services.analytics import certification_status
from ..services.document_intelligence import analyze_document
from ..services.files import save_upload
from .deps import get_db

router = APIRouter(prefix="/certifications", tags=["certifications"])


def to_certification_read(certification: Certification) -> CertificationRead:
    contractor_name = certification.worker.contractor.name if certification.worker and certification.worker.contractor else certification.contractor
    return CertificationRead(
        id=certification.id,
        worker_id=certification.worker_id,
        title=certification.title,
        contractor=contractor_name,
        issue_date=certification.issue_date,
        expiration_date=certification.expiration_date,
        file_name=certification.file_name,
        file_path=certification.file_path,
        file_type=certification.file_type,
        notes=certification.notes,
        created_at=certification.created_at,
        status=certification_status(certification),
        file_url=f"/uploads/{certification.file_path}" if certification.file_path and not certification.file_path.startswith("demo/") else None,
        worker_name=certification.worker.full_name if certification.worker else None,
        company_name=certification.worker.company.name if certification.worker and certification.worker.company else None,
        contractor_name=contractor_name,
    )


@router.post("/analyze", response_model=CertificationAnalysis)
async def analyze_certification_file(file: UploadFile = File(...)) -> CertificationAnalysis:
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    return CertificationAnalysis(
        **analyze_document(file_bytes, file.filename or "document", file.content_type)
    )


@router.get("", response_model=list[CertificationRead])
def list_certifications(
    company_id: int | None = Query(default=None),
    worker_id: int | None = Query(default=None),
    search: str | None = Query(default=None),
    contractor: str | None = Query(default=None),
    status_filter: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[CertificationRead]:
    query = select(Certification).join(Certification.worker).options(
        selectinload(Certification.worker).selectinload(Worker.company),
        selectinload(Certification.worker).selectinload(Worker.contractor),
    )

    if company_id:
        query = query.where(Worker.company_id == company_id)
    if worker_id:
        query = query.where(Certification.worker_id == worker_id)
    if contractor:
        query = query.where(Certification.contractor == contractor)
    if search:
        pattern = f"%{search.strip()}%"
        query = query.where(
            or_(
                Certification.title.ilike(pattern),
                Certification.contractor.ilike(pattern),
                Certification.file_name.ilike(pattern),
            )
        )

    certifications = db.scalars(query.order_by(Certification.expiration_date)).all()
    mapped = [to_certification_read(certification) for certification in certifications]
    if status_filter:
        mapped = [certification for certification in mapped if certification.status == status_filter]
    return mapped


@router.post("", response_model=CertificationRead, status_code=status.HTTP_201_CREATED)
async def create_certification(
    worker_id: int = Form(...),
    title: str = Form(...),
    contractor: str | None = Form(default=None),
    issue_date: date | None = Form(default=None),
    expiration_date: date | None = Form(default=None),
    notes: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
) -> CertificationRead:
    worker = db.get(Worker, worker_id)
    if worker is None:
        raise HTTPException(status_code=404, detail="Worker not found")

    contractor_name = contractor
    if worker.contractor_id is not None:
        worker = db.scalar(
            select(Worker)
            .where(Worker.id == worker_id)
            .options(selectinload(Worker.contractor))
        )
        contractor_name = worker.contractor.name if worker.contractor else contractor

    stored_name = None
    original_name = None
    file_type = None
    if file is not None:
        stored_name, original_name = await save_upload(file)
        file_type = file.content_type

    certification = Certification(
        worker_id=worker_id,
        title=title,
        contractor=contractor_name,
        issue_date=issue_date,
        expiration_date=expiration_date,
        notes=notes,
        file_name=original_name,
        file_path=stored_name,
        file_type=file_type,
    )
    db.add(certification)
    db.commit()
    certification = db.scalar(
        select(Certification)
        .where(Certification.id == certification.id)
        .options(
            selectinload(Certification.worker).selectinload(Worker.company),
            selectinload(Certification.worker).selectinload(Worker.contractor),
        )
    )
    return to_certification_read(certification)


@router.delete("/{certification_id}")
def delete_certification(certification_id: int, db: Session = Depends(get_db)) -> dict[str, str]:
    certification = db.get(Certification, certification_id)
    if certification is None:
        raise HTTPException(status_code=404, detail="Certification not found")
    if certification.file_path and not certification.file_path.startswith("demo/"):
        file_location = Path(UPLOAD_DIR) / certification.file_path
        if file_location.exists():
            file_location.unlink()
    db.delete(certification)
    db.commit()
    return {"message": "Certification deleted"}
