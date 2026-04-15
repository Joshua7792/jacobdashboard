from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..models import Certification, Company, Worker
from ..schemas import DashboardMetric, DashboardOverview
from ..services.analytics import (
    build_onboarding_trend,
    certification_health,
    certification_status,
    contractor_distribution,
)
from .deps import get_db
from .workers import to_worker_read
from .certifications import to_certification_read

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/overview", response_model=DashboardOverview)
def overview(company_id: int | None = Query(default=None), db: Session = Depends(get_db)) -> DashboardOverview:
    company_scope = "All companies"
    worker_query = select(Worker).options(
        selectinload(Worker.company),
        selectinload(Worker.contractor),
        selectinload(Worker.certifications),
    )
    cert_query = select(Certification).join(Certification.worker).options(
        selectinload(Certification.worker).selectinload(Worker.contractor)
    )

    if company_id:
        company = db.get(Company, company_id)
        if company:
            company_scope = company.name
        worker_query = worker_query.where(Worker.company_id == company_id)
        cert_query = cert_query.where(Worker.company_id == company_id)

    workers = db.scalars(worker_query.order_by(Worker.created_at.desc())).all()
    certifications = db.scalars(cert_query).all()

    today = date.today()
    new_workers = [
        worker
        for worker in workers
        if (worker.hire_date or worker.created_at.date()) >= today - timedelta(days=30)
    ]
    expiring = [
        certification
        for certification in certifications
        if certification.expiration_date is not None and today <= certification.expiration_date <= today + timedelta(days=30)
    ]
    expired = [certification for certification in certifications if certification_status(certification) == "expired"]

    metrics = [
        DashboardMetric(label="Employees", value=len(workers)),
        DashboardMetric(label="New in 30 days", value=len(new_workers)),
        DashboardMetric(label="Expiring soon", value=len(expiring)),
        DashboardMetric(label="Expired certs", value=len(expired)),
    ]

    expiring_reads = [to_certification_read(certification) for certification in sorted(expiring, key=lambda cert: cert.expiration_date or today)[:6]]
    recent_workers = [
        to_worker_read(worker)
        for worker in sorted(
            workers,
            key=lambda worker: worker.hire_date or worker.created_at.date(),
            reverse=True,
        )[:6]
    ]

    return DashboardOverview(
        company_scope=company_scope,
        metrics=metrics,
        onboarding_trend=build_onboarding_trend(workers),
        contractor_distribution=contractor_distribution(certifications),
        certification_health=certification_health(certifications),
        expiring_certifications=expiring_reads,
        recent_workers=recent_workers,
    )
