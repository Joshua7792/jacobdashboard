from __future__ import annotations

from collections import Counter

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..models import TrainingCatalog, Worker, WorkerTraining
from ..schemas import ChartPoint, ReportPreview, ReportRequest
from ..services.analytics import month_key, training_status, worker_compliance_counts
from .deps import get_db

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("/preview", response_model=ReportPreview)
def preview_report(payload: ReportRequest, db: Session = Depends(get_db)) -> ReportPreview:
    rows: list[ChartPoint] = []
    catalog_items = db.scalars(select(TrainingCatalog).order_by(TrainingCatalog.display_order)).all()

    if payload.dataset == "workers":
        workers = db.scalars(
            select(Worker).options(
                selectinload(Worker.company),
                selectinload(Worker.contractor),
                selectinload(Worker.trainings),
            )
        ).all()
        if payload.company_id:
            workers = [worker for worker in workers if worker.company_id == payload.company_id]

        if payload.group_by == "project":
            counts = Counter(worker.company.name for worker in workers)
        elif payload.group_by == "contractor":
            counts = Counter(worker.contractor.name if worker.contractor else "Unassigned" for worker in workers)
        elif payload.group_by == "status":
            counts = Counter(worker.onboarding_status for worker in workers)
        elif payload.group_by == "month":
            counts = Counter(month_key(worker.hire_date or worker.created_at.date()) for worker in workers)
        elif payload.group_by == "compliance":
            counts = Counter(worker_compliance_counts(worker, len(catalog_items))["status"] for worker in workers)
        else:
            raise HTTPException(status_code=400, detail="Unsupported worker report grouping")
    elif payload.dataset == "trainings":
        trainings = db.scalars(
            select(WorkerTraining).options(
                selectinload(WorkerTraining.worker).selectinload(Worker.contractor),
                selectinload(WorkerTraining.catalog_item),
            )
        ).all()
        if payload.company_id:
            trainings = [training for training in trainings if training.worker.company_id == payload.company_id]

        if payload.group_by == "contractor":
            counts = Counter(
                training.worker.contractor.name if training.worker and training.worker.contractor else "Unassigned"
                for training in trainings
            )
        elif payload.group_by == "status":
            counts = Counter(training_status(training) for training in trainings)
        elif payload.group_by == "category":
            counts = Counter(training.catalog_item.category for training in trainings)
        elif payload.group_by == "training":
            counts = Counter(training.catalog_item.name for training in trainings)
        else:
            raise HTTPException(status_code=400, detail="Unsupported training report grouping")
    else:
        raise HTTPException(status_code=400, detail="Unsupported dataset")

    rows = [ChartPoint(label=str(label), value=int(value)) for label, value in counts.most_common()]
    dataset_label = "Workers" if payload.dataset == "workers" else "Trainings"
    title = f"{dataset_label} grouped by {payload.group_by.replace('_', ' ')}"
    return ReportPreview(title=title, dataset=payload.dataset, group_by=payload.group_by, rows=rows)
