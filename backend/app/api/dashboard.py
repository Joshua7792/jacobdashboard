from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..models import Company, Contractor, SourceDocument, TrainingCatalog, Worker, WorkerTraining
from ..schemas import DashboardMetric, DashboardOverview
from ..services.analytics import contractor_compliance_chart, training_coverage_chart
from .deps import get_db
from .serializers import to_source_document_read, to_worker_read

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/overview", response_model=DashboardOverview)
def overview(company_id: int | None = Query(default=None), db: Session = Depends(get_db)) -> DashboardOverview:
    company_scope = "All projects"
    worker_query = select(Worker).options(
        selectinload(Worker.company),
        selectinload(Worker.contractor),
        selectinload(Worker.trainings).selectinload(WorkerTraining.catalog_item),
        selectinload(Worker.trainings).selectinload(WorkerTraining.source_document),
    )
    document_query = select(SourceDocument).join(SourceDocument.contractor).options(
        selectinload(SourceDocument.contractor).selectinload(Contractor.company),
        selectinload(SourceDocument.trainings),
    )

    if company_id:
        company = db.get(Company, company_id)
        if company:
            company_scope = company.name
        worker_query = worker_query.where(Worker.company_id == company_id)
        document_query = document_query.where(SourceDocument.contractor.has(company_id=company_id))

    workers = db.scalars(worker_query.order_by(Worker.created_at.desc())).all()
    documents = db.scalars(document_query.order_by(SourceDocument.created_at.desc())).all()
    catalog_items = db.scalars(select(TrainingCatalog).order_by(TrainingCatalog.display_order)).all()
    total_required = len(catalog_items)

    completed_items = sum(1 for worker in workers for training in worker.trainings if training.completed_on)
    pending_items = max((len(workers) * total_required) - completed_items, 0)
    active_contractors = len({worker.contractor_id for worker in workers if worker.contractor_id is not None})
    metrics = [
        DashboardMetric(label="Project workforce", value=len(workers), sub_label="Workers on Cordillera"),
        DashboardMetric(label="Active contractors", value=active_contractors, sub_label="Contractors with workers"),
        DashboardMetric(label="Completed records", value=completed_items, sub_label="Training dates on file"),
        DashboardMetric(label="Pending items", value=pending_items, sub_label="Missing training dates"),
    ]

    recent_imports = [to_source_document_read(document) for document in documents[:4]]
    recent_workers = [to_worker_read(worker, catalog_items) for worker in workers[:6]]

    return DashboardOverview(
        company_scope=company_scope,
        metrics=metrics,
        contractor_compliance=contractor_compliance_chart(workers, catalog_items),
        training_coverage=training_coverage_chart(workers, catalog_items),
        recent_imports=recent_imports,
        recent_workers=recent_workers,
    )
