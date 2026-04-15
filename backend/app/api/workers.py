from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from ..models import Company, Contractor, Worker
from ..schemas import CertificationRead, WorkerCreate, WorkerRead, WorkerUpdate
from ..services.analytics import certification_status, worker_certification_status
from .deps import get_db

router = APIRouter(prefix="/workers", tags=["workers"])


def to_certification_read(certification):
    worker = getattr(certification, "worker", None)
    contractor_name = worker.contractor.name if worker and worker.contractor else certification.contractor
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
        worker_name=worker.full_name if worker else None,
        company_name=worker.company.name if worker else None,
        contractor_name=contractor_name,
    )


def to_worker_read(worker: Worker) -> WorkerRead:
    certifications = [to_certification_read(certification) for certification in worker.certifications]
    return WorkerRead(
        id=worker.id,
        company_id=worker.company_id,
        contractor_id=worker.contractor_id,
        full_name=worker.full_name,
        employee_code=worker.employee_code,
        job_title=worker.job_title,
        onboarding_status=worker.onboarding_status,
        hire_date=worker.hire_date,
        email=worker.email,
        phone=worker.phone,
        notes=worker.notes,
        created_at=worker.created_at,
        updated_at=worker.updated_at,
        company_name=worker.company.name,
        contractor_name=worker.contractor.name if worker.contractor else None,
        certification_count=len(certifications),
        certification_status=worker_certification_status(worker),
        certifications=certifications,
    )


@router.get("", response_model=list[WorkerRead])
def list_workers(
    company_id: int | None = Query(default=None),
    search: str | None = Query(default=None),
    onboarding_status: str | None = Query(default=None),
    cert_status: str | None = Query(default=None),
    contractor_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[WorkerRead]:
    query = select(Worker).options(
        selectinload(Worker.company),
        selectinload(Worker.contractor),
        selectinload(Worker.certifications),
    )

    if company_id:
        query = query.where(Worker.company_id == company_id)
    if contractor_id:
        query = query.where(Worker.contractor_id == contractor_id)
    if onboarding_status:
        query = query.where(Worker.onboarding_status == onboarding_status)
    if search:
        pattern = f"%{search.strip()}%"
        query = query.where(
            or_(
                Worker.full_name.ilike(pattern),
                Worker.employee_code.ilike(pattern),
                Worker.job_title.ilike(pattern),
                Worker.email.ilike(pattern),
            )
        )

    workers = db.scalars(query.order_by(Worker.full_name)).all()
    mapped_workers = [to_worker_read(worker) for worker in workers]
    if cert_status:
        mapped_workers = [worker for worker in mapped_workers if worker.certification_status == cert_status]
    return mapped_workers


@router.post("", response_model=WorkerRead, status_code=status.HTTP_201_CREATED)
def create_worker(payload: WorkerCreate, db: Session = Depends(get_db)) -> WorkerRead:
    company = db.get(Company, payload.company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")

    contractor = None
    if payload.contractor_id is not None:
        contractor = db.get(Contractor, payload.contractor_id)
        if contractor is None or contractor.company_id != payload.company_id:
            raise HTTPException(status_code=404, detail="Contractor not found for company")

    worker = Worker(**payload.model_dump())
    db.add(worker)
    db.commit()
    worker = db.scalar(
        select(Worker)
        .where(Worker.id == worker.id)
        .options(selectinload(Worker.company), selectinload(Worker.contractor), selectinload(Worker.certifications))
    )
    return to_worker_read(worker)


@router.put("/{worker_id}", response_model=WorkerRead)
def update_worker(worker_id: int, payload: WorkerUpdate, db: Session = Depends(get_db)) -> WorkerRead:
    worker = db.scalar(
        select(Worker)
        .where(Worker.id == worker_id)
        .options(selectinload(Worker.company), selectinload(Worker.certifications))
    )
    if worker is None:
        raise HTTPException(status_code=404, detail="Worker not found")

    company = db.get(Company, payload.company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    if payload.contractor_id is not None:
        contractor = db.get(Contractor, payload.contractor_id)
        if contractor is None or contractor.company_id != payload.company_id:
            raise HTTPException(status_code=404, detail="Contractor not found for company")

    for field, value in payload.model_dump().items():
        setattr(worker, field, value)

    db.commit()
    worker = db.scalar(
        select(Worker)
        .where(Worker.id == worker_id)
        .options(selectinload(Worker.company), selectinload(Worker.contractor), selectinload(Worker.certifications))
    )
    return to_worker_read(worker)


@router.delete("/{worker_id}")
def delete_worker(worker_id: int, db: Session = Depends(get_db)) -> dict[str, str]:
    worker = db.get(Worker, worker_id)
    if worker is None:
        raise HTTPException(status_code=404, detail="Worker not found")
    db.delete(worker)
    db.commit()
    return {"message": "Worker deleted"}
