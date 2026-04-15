from __future__ import annotations

from collections import Counter

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..models import Certification, Worker
from ..schemas import ChartPoint, ReportPreview, ReportRequest
from ..services.analytics import certification_status, month_key, worker_certification_status
from .deps import get_db

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("/preview", response_model=ReportPreview)
def preview_report(payload: ReportRequest, db: Session = Depends(get_db)) -> ReportPreview:
    rows: list[ChartPoint] = []

    if payload.dataset == "workers":
        workers = db.scalars(
            select(Worker).options(
                selectinload(Worker.company),
                selectinload(Worker.contractor),
                selectinload(Worker.certifications),
            )
        ).all()
        if payload.company_id:
            workers = [worker for worker in workers if worker.company_id == payload.company_id]

        if payload.group_by == "company":
            counts = Counter(worker.company.name for worker in workers)
        elif payload.group_by == "contractor":
            counts = Counter(worker.contractor.name if worker.contractor else "Unassigned" for worker in workers)
        elif payload.group_by == "status":
            counts = Counter(worker.onboarding_status for worker in workers)
        elif payload.group_by == "month":
            counts = Counter(month_key(worker.hire_date or worker.created_at.date()) for worker in workers)
        elif payload.group_by == "certification_status":
            counts = Counter(worker_certification_status(worker) for worker in workers)
        else:
            raise HTTPException(status_code=400, detail="Unsupported worker report grouping")
    elif payload.dataset == "certifications":
        certifications = db.scalars(
            select(Certification).join(Certification.worker).options(
                selectinload(Certification.worker).selectinload(Worker.contractor)
            )
        ).all()
        if payload.company_id:
            certifications = [certification for certification in certifications if certification.worker.company_id == payload.company_id]

        if payload.group_by == "contractor":
            counts = Counter(
                certification.worker.contractor.name
                if certification.worker and certification.worker.contractor
                else certification.contractor or "Unassigned"
                for certification in certifications
            )
        elif payload.group_by == "status":
            counts = Counter(certification_status(certification) for certification in certifications)
        elif payload.group_by == "month":
            counts = Counter(month_key(certification.expiration_date or certification.created_at.date()) for certification in certifications)
        else:
            raise HTTPException(status_code=400, detail="Unsupported certification report grouping")
    else:
        raise HTTPException(status_code=400, detail="Unsupported dataset")

    rows = [ChartPoint(label=label, value=value) for label, value in counts.most_common()]
    dataset_label = "Employees" if payload.dataset == "workers" else payload.dataset.title()
    title = f"{dataset_label} grouped by {payload.group_by.replace('_', ' ')}"
    return ReportPreview(title=title, dataset=payload.dataset, group_by=payload.group_by, rows=rows)
