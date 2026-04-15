from __future__ import annotations

import csv
import io

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..models import Certification, Worker
from ..services.analytics import certification_status, worker_certification_status
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
        selectinload(Worker.certifications),
    )
    if company_id:
        query = query.where(Worker.company_id == company_id)
    workers = db.scalars(query.order_by(Worker.full_name)).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "employee_id",
            "company",
            "contractor",
            "full_name",
            "employee_code",
            "job_title",
            "onboarding_status",
            "hire_date",
            "email",
            "phone",
            "certification_status",
            "certification_count",
            "notes",
        ]
    )
    for worker in workers:
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
                worker_certification_status(worker),
                len(worker.certifications),
                worker.notes or "",
            ]
        )

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=employees-export.csv"},
    )


@router.get("/certifications.csv")
def export_certifications_csv(
    company_id: int | None = Query(default=None),
    status_filter: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    query = select(Certification).join(Certification.worker).options(
        selectinload(Certification.worker).selectinload(Worker.company),
        selectinload(Certification.worker).selectinload(Worker.contractor),
    )
    if company_id:
        query = query.where(Worker.company_id == company_id)
    certifications = db.scalars(query.order_by(Certification.expiration_date)).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "certification_id",
            "company",
            "employee",
            "title",
            "contractor",
            "issue_date",
            "expiration_date",
            "status",
            "file_name",
            "notes",
        ]
    )
    for certification in certifications:
        status_value = certification_status(certification)
        if status_filter and status_value != status_filter:
            continue
        writer.writerow(
            [
                certification.id,
                certification.worker.company.name,
                certification.worker.full_name,
                certification.title,
                certification.worker.contractor.name if certification.worker and certification.worker.contractor else certification.contractor or "",
                certification.issue_date.isoformat() if certification.issue_date else "",
                certification.expiration_date.isoformat() if certification.expiration_date else "",
                status_value,
                certification.file_name or "",
                certification.notes or "",
            ]
        )

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=certifications-export.csv"},
    )
