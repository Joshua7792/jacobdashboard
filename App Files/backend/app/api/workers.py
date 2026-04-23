from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from ..models import Company, Contractor, TrainingCatalog, Worker, WorkerTraining
from ..schemas import WorkerCreate, WorkerRead, WorkerUpdate
from .deps import get_db
from .serializers import to_worker_read

router = APIRouter(prefix="/workers", tags=["workers"])


def worker_query():
    return select(Worker).options(
        selectinload(Worker.company),
        selectinload(Worker.contractor),
        selectinload(Worker.trainings).selectinload(WorkerTraining.catalog_item),
        selectinload(Worker.trainings).selectinload(WorkerTraining.source_document),
    )


@router.get("", response_model=list[WorkerRead])
def list_workers(
    company_id: int | None = Query(default=None),
    search: str | None = Query(default=None),
    onboarding_status: str | None = Query(default=None),
    compliance_status: str | None = Query(default=None),
    cert_status: str | None = Query(default=None),
    contractor_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[WorkerRead]:
    query = worker_query()

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
    catalog_items = db.scalars(select(TrainingCatalog).order_by(TrainingCatalog.display_order)).all()
    mapped_workers = [to_worker_read(worker, catalog_items) for worker in workers]
    status_filter = compliance_status or cert_status
    if status_filter:
        mapped_workers = [worker for worker in mapped_workers if worker.compliance_status == status_filter]
    return mapped_workers


@router.post("", response_model=WorkerRead, status_code=status.HTTP_201_CREATED)
def create_worker(payload: WorkerCreate, db: Session = Depends(get_db)) -> WorkerRead:
    company = db.get(Company, payload.company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="Project not found")

    if payload.contractor_id is not None:
        contractor = db.get(Contractor, payload.contractor_id)
        if contractor is None or contractor.company_id != payload.company_id:
            raise HTTPException(status_code=404, detail="Contractor not found for project")

    worker = Worker(**payload.model_dump())
    db.add(worker)
    db.commit()
    worker = db.scalar(worker_query().where(Worker.id == worker.id))
    catalog_items = db.scalars(select(TrainingCatalog).order_by(TrainingCatalog.display_order)).all()
    return to_worker_read(worker, catalog_items)


@router.put("/{worker_id}", response_model=WorkerRead)
def update_worker(worker_id: int, payload: WorkerUpdate, db: Session = Depends(get_db)) -> WorkerRead:
    worker = db.scalar(worker_query().where(Worker.id == worker_id))
    if worker is None:
        raise HTTPException(status_code=404, detail="Worker not found")

    company = db.get(Company, payload.company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="Project not found")
    if payload.contractor_id is not None:
        contractor = db.get(Contractor, payload.contractor_id)
        if contractor is None or contractor.company_id != payload.company_id:
            raise HTTPException(status_code=404, detail="Contractor not found for project")

    for field, value in payload.model_dump().items():
        setattr(worker, field, value)

    db.commit()
    worker = db.scalar(worker_query().where(Worker.id == worker_id))
    catalog_items = db.scalars(select(TrainingCatalog).order_by(TrainingCatalog.display_order)).all()
    return to_worker_read(worker, catalog_items)


@router.delete("/{worker_id}")
def delete_worker(worker_id: int, db: Session = Depends(get_db)) -> dict[str, str]:
    worker = db.get(Worker, worker_id)
    if worker is None:
        raise HTTPException(status_code=404, detail="Worker not found")
    db.delete(worker)
    db.commit()
    return {"message": "Worker deleted"}
