from __future__ import annotations

import csv
import io

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..models import TrainingCatalog, Worker, WorkerTraining
from ..services.analytics import training_status, worker_compliance_counts
from .deps import get_db

router = APIRouter(prefix="/exports", tags=["exports"])


@router.get("/workers.csv")
def export_workers_csv(
    company_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    query = select(Worker).options(
        selectinload(Worker.company),
        selectinload(Worker.contractor),
        selectinload(Worker.trainings),
    )
    if company_id:
        query = query.where(Worker.company_id == company_id)
    workers = db.scalars(query.order_by(Worker.full_name)).all()
    catalog_items = db.scalars(select(TrainingCatalog).order_by(TrainingCatalog.display_order)).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "worker_id",
            "project",
            "contractor",
            "full_name",
            "employee_code",
            "job_title",
            "onboarding_status",
            "hire_date",
            "email",
            "phone",
            "compliance_status",
            "trainings_completed",
            "trainings_required",
            "compliance_pct",
            "notes",
        ]
    )
    for worker in workers:
        counts = worker_compliance_counts(worker, len(catalog_items))
        writer.writerow(
            [
                worker.id,
                worker.company.name,
                worker.contractor.name if worker.contractor else "",
                worker.full_name,
                worker.employee_code or "",
                worker.job_title or "",
                worker.onboarding_status,
                worker.hire_date.isoformat() if worker.hire_date else "",
                worker.email or "",
                worker.phone or "",
                counts["status"],
                counts["completed"],
                counts["required"],
                counts["compliance_pct"],
                worker.notes or "",
            ]
        )

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=cordillera-workers.csv"},
    )


@router.get("/trainings.csv")
def export_trainings_csv(
    company_id: int | None = Query(default=None),
    status_filter: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    query = select(WorkerTraining).options(
        selectinload(WorkerTraining.worker).selectinload(Worker.company),
        selectinload(WorkerTraining.worker).selectinload(Worker.contractor),
        selectinload(WorkerTraining.catalog_item),
        selectinload(WorkerTraining.source_document),
    )
    if company_id:
        query = query.where(WorkerTraining.worker.has(company_id=company_id))
    trainings = db.scalars(query.order_by(WorkerTraining.completed_on, WorkerTraining.id)).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "training_id",
            "project",
            "worker",
            "contractor",
            "training_name",
            "category",
            "completed_on",
            "status",
            "source_document",
            "evidence_file",
            "notes",
        ]
    )
    for training in trainings:
        status_value = training_status(training)
        if status_filter and status_value != status_filter:
            continue
        writer.writerow(
            [
                training.id,
                training.worker.company.name,
                training.worker.full_name,
                training.worker.contractor.name if training.worker.contractor else "",
                training.catalog_item.name,
                training.catalog_item.category,
                training.completed_on.isoformat() if training.completed_on else "",
                status_value,
                training.source_document.original_file_name if training.source_document else "",
                training.evidence_file_name or "",
                training.notes or "",
            ]
        )

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=cordillera-trainings.csv"},
    )
