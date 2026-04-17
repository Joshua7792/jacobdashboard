from __future__ import annotations

from ..models import Company, Contractor, SourceDocument, TrainingCatalog, Worker, WorkerTraining
from ..schemas import SourceDocumentRead, WorkerRead, WorkerTrainingRead
from ..services.analytics import training_status, worker_compliance_counts


def to_training_read(
    *,
    worker: Worker,
    catalog_item: TrainingCatalog,
    training: WorkerTraining | None,
) -> WorkerTrainingRead:
    source_document = training.source_document if training else None
    contractor_name = worker.contractor.name if worker.contractor else None
    evidence_url = None
    if training and training.evidence_stored_name:
        evidence_url = f"/uploads/{training.evidence_stored_name}"

    return WorkerTrainingRead(
        id=training.id if training else None,
        worker_id=worker.id,
        catalog_id=catalog_item.id,
        catalog_name=catalog_item.name,
        category=catalog_item.category,
        display_order=catalog_item.display_order,
        completed_on=training.completed_on if training else None,
        source_document_id=training.source_document_id if training else None,
        source_document_name=source_document.original_file_name if source_document else None,
        evidence_file_name=training.evidence_file_name if training else None,
        evidence_file_type=training.evidence_file_type if training else None,
        evidence_url=evidence_url,
        notes=training.notes if training else None,
        status=training_status(training),
        worker_name=worker.full_name,
        contractor_name=contractor_name,
        company_name=worker.company.name if worker.company else None,
        created_at=training.created_at if training else None,
        updated_at=training.updated_at if training else None,
    )


def materialize_worker_trainings(worker: Worker, catalog_items: list[TrainingCatalog]) -> list[WorkerTrainingRead]:
    existing_by_catalog = {training.catalog_id: training for training in worker.trainings}
    rows = [
        to_training_read(
            worker=worker,
            catalog_item=catalog_item,
            training=existing_by_catalog.get(catalog_item.id),
        )
        for catalog_item in catalog_items
    ]
    return sorted(rows, key=lambda row: (row.display_order, row.catalog_name))


def to_worker_read(worker: Worker, catalog_items: list[TrainingCatalog]) -> WorkerRead:
    trainings = materialize_worker_trainings(worker, catalog_items)
    counts = worker_compliance_counts(worker, len(catalog_items))
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
        trainings_completed=int(counts["completed"]),
        trainings_required=int(counts["required"]),
        compliance_pct=int(counts["compliance_pct"]),
        compliance_status=str(counts["status"]),
        trainings=trainings,
    )


def company_training_counts(company: Company, catalog_items: list[TrainingCatalog]) -> tuple[int, int]:
    required = len(company.workers) * len(catalog_items)
    completed = sum(1 for worker in company.workers for training in worker.trainings if training.completed_on)
    return completed, required


def contractor_training_counts(contractor: Contractor, catalog_items: list[TrainingCatalog]) -> tuple[int, int]:
    required = len(contractor.workers) * len(catalog_items)
    completed = sum(1 for worker in contractor.workers for training in worker.trainings if training.completed_on)
    return completed, required


def to_source_document_read(document: SourceDocument) -> SourceDocumentRead:
    return SourceDocumentRead(
        id=document.id,
        contractor_id=document.contractor_id,
        contractor_name=document.contractor.name,
        company_name=document.contractor.company.name,
        document_kind=document.document_kind,
        title=document.title,
        original_file_name=document.original_file_name,
        file_type=document.file_type,
        completed_on=document.completed_on,
        created_at=document.created_at,
        file_url=f"/uploads/{document.stored_file_name}" if document.stored_file_name else None,
        training_count=len(document.trainings),
    )
