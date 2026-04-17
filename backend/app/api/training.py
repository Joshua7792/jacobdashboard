from __future__ import annotations

from collections import Counter
from datetime import date
from pathlib import Path
import unicodedata

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from ..config import DEFAULT_COMPANY_NAME
from ..database import UPLOAD_DIR
from ..models import Company, Contractor, SourceDocument, TrainingCatalog, Worker, WorkerTraining
from ..schemas import (
    ContractorMatrixImportResult,
    ContractorMatrixPreview,
    MatrixEmployeePreview,
    MatrixRecordPreview,
    SourceDocumentRead,
    TrainingCatalogRead,
    WorkerTrainingRead,
)
from ..services.catalog import build_database_catalog_lookup, normalize_catalog_key
from ..services.contractor_matrix import contractor_alias, normalize_name, parse_contractor_matrix
from ..services.files import sanitize_filename, save_upload
from .deps import get_db
from .serializers import to_source_document_read, to_training_read

router = APIRouter(prefix="/training", tags=["training"])


def normalize_key(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_only = "".join(char for char in normalized if not unicodedata.combining(char))
    return " ".join(ascii_only.lower().split())


def catalog_items_query():
    return select(TrainingCatalog).order_by(TrainingCatalog.display_order, TrainingCatalog.id)


def training_rows_query():
    return (
        select(WorkerTraining)
        .join(WorkerTraining.worker)
        .join(WorkerTraining.catalog_item)
        .options(
            selectinload(WorkerTraining.worker).selectinload(Worker.company),
            selectinload(WorkerTraining.worker).selectinload(Worker.contractor),
            selectinload(WorkerTraining.catalog_item),
            selectinload(WorkerTraining.source_document),
        )
    )


def worker_query():
    return select(Worker).options(
        selectinload(Worker.company),
        selectinload(Worker.contractor),
        selectinload(Worker.trainings).selectinload(WorkerTraining.catalog_item),
        selectinload(Worker.trainings).selectinload(WorkerTraining.source_document),
    )


def resolve_company(db: Session, company_id: int | None) -> Company:
    if company_id is not None:
        company = db.get(Company, company_id)
        if company is None:
            raise HTTPException(status_code=404, detail="Project not found")
        return company

    company = db.scalar(select(Company).where(Company.name == DEFAULT_COMPANY_NAME))
    if company is None:
        company = db.scalar(select(Company).order_by(Company.name))
    if company is None:
        raise HTTPException(status_code=400, detail="Create a project before importing documents")
    return company


def resolve_contractor(db: Session, company: Company, parsed_name: str) -> Contractor:
    contractors = db.scalars(
        select(Contractor).where(Contractor.company_id == company.id).order_by(Contractor.name)
    ).all()
    target_name = contractor_alias(parsed_name)
    target_key = normalize_key(target_name)
    for contractor in contractors:
        contractor_key = normalize_key(contractor.name)
        if contractor_key == target_key or contractor_key in target_key or target_key in contractor_key:
            return contractor

    contractor = Contractor(company_id=company.id, name=target_name)
    db.add(contractor)
    db.flush()
    return contractor


def worker_lookup(db: Session, company_id: int) -> dict[str, Worker]:
    workers = db.scalars(worker_query().where(Worker.company_id == company_id)).all()
    return {normalize_name(worker.full_name): worker for worker in workers}


def catalog_lookup(db: Session) -> tuple[list[TrainingCatalog], dict[str, TrainingCatalog]]:
    catalog_items = db.scalars(catalog_items_query()).all()
    return catalog_items, build_database_catalog_lookup(catalog_items)


def resolve_catalog_item(
    db: Session,
    lookup: dict[str, TrainingCatalog],
    title: str,
    category: str,
) -> TrainingCatalog:
    normalized = normalize_catalog_key(title)
    catalog_item = lookup.get(normalized)
    if catalog_item is not None:
        return catalog_item

    max_order = db.scalar(select(TrainingCatalog.display_order).order_by(TrainingCatalog.display_order.desc()).limit(1)) or 0
    catalog_item = TrainingCatalog(name=title.strip(), category=category, display_order=max_order + 1)
    db.add(catalog_item)
    db.flush()
    lookup.update(build_database_catalog_lookup(db.scalars(catalog_items_query()).all()))
    return catalog_item


def upsert_training_row(
    db: Session,
    *,
    worker_id: int,
    catalog_id: int,
    completed_on,
    source_document_id: int | None = None,
    evidence_file_name: str | None = None,
    evidence_stored_name: str | None = None,
    evidence_file_type: str | None = None,
    notes: str | None = None,
) -> tuple[WorkerTraining, bool, bool]:
    row = db.scalar(
        training_rows_query().where(WorkerTraining.worker_id == worker_id, WorkerTraining.catalog_id == catalog_id)
    )
    created = False
    updated = False

    if row is None:
        row = WorkerTraining(worker_id=worker_id, catalog_id=catalog_id)
        db.add(row)
        db.flush()
        created = True

    if completed_on != row.completed_on:
        row.completed_on = completed_on
        updated = True
    if source_document_id is not None and source_document_id != row.source_document_id:
        row.source_document_id = source_document_id
        updated = True
    if evidence_file_name is not None and evidence_file_name != row.evidence_file_name:
        row.evidence_file_name = evidence_file_name
        updated = True
    if evidence_stored_name is not None and evidence_stored_name != row.evidence_stored_name:
        row.evidence_stored_name = evidence_stored_name
        updated = True
    if evidence_file_type is not None and evidence_file_type != row.evidence_file_type:
        row.evidence_file_type = evidence_file_type
        updated = True
    if notes is not None and notes != row.notes:
        row.notes = notes
        updated = True

    db.flush()
    row = db.scalar(
        training_rows_query().where(WorkerTraining.worker_id == worker_id, WorkerTraining.catalog_id == catalog_id)
    )
    return row, created, updated


def build_preview(
    db: Session,
    company: Company,
    contractor: Contractor,
    parsed,
    filename: str,
) -> ContractorMatrixPreview:
    workers_by_name = worker_lookup(db, company.id)
    _, lookup = catalog_lookup(db)

    employee_counter: Counter[str] = Counter()
    training_counter: Counter[str] = Counter()
    preview_rows: list[MatrixRecordPreview] = []
    unknown_columns: list[str] = []

    combined_entries = [
        *[(entry, "primary") for entry in parsed.training_records],
        *[(entry, "otros") for entry in parsed.certifications],
    ]

    for entry, category in combined_entries:
        employee_counter[entry.employee_name] += 1
        training_counter[entry.employee_name] += 1
        catalog_item = lookup.get(normalize_catalog_key(entry.title))
        if catalog_item is None:
            unknown_columns.append(entry.title)
        preview_rows.append(
            MatrixRecordPreview(
                employee_name=entry.employee_name,
                catalog_name=catalog_item.name if catalog_item else entry.title,
                catalog_id=catalog_item.id if catalog_item else None,
                category=catalog_item.category if catalog_item else category,
                completed_on=entry.issue_date,
                matched_worker_id=workers_by_name.get(normalize_name(entry.employee_name)).id
                if normalize_name(entry.employee_name) in workers_by_name
                else None,
            )
        )

    employee_matches = [
        MatrixEmployeePreview(
            employee_name=employee_name,
            matched_worker_id=workers_by_name.get(normalize_name(employee_name)).id
            if normalize_name(employee_name) in workers_by_name
            else None,
            action="update" if normalize_name(employee_name) in workers_by_name else "create",
            training_count=training_counter[employee_name],
        )
        for employee_name in sorted(employee_counter)
    ]

    return ContractorMatrixPreview(
        contractor_name=contractor.name,
        original_contractor_name=parsed.contractor_name,
        company_name=company.name,
        file_name=filename,
        completed_on=parsed.completed_on,
        analysis_source=parsed.analysis_source,
        language=parsed.language,
        employee_matches=employee_matches,
        trainings=preview_rows,
        unknown_columns=sorted(set(unknown_columns)),
    )


@router.get("/catalog", response_model=list[TrainingCatalogRead])
def list_training_catalog(db: Session = Depends(get_db)) -> list[TrainingCatalogRead]:
    return db.scalars(catalog_items_query()).all()


@router.get("/records", response_model=list[WorkerTrainingRead])
def list_training_records(
    company_id: int | None = Query(default=None),
    contractor_id: int | None = Query(default=None),
    worker_id: int | None = Query(default=None),
    status_filter: str | None = Query(default=None),
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[WorkerTrainingRead]:
    query = training_rows_query()
    if company_id:
        query = query.where(Worker.company_id == company_id)
    if contractor_id:
        query = query.where(Worker.contractor_id == contractor_id)
    if worker_id:
        query = query.where(WorkerTraining.worker_id == worker_id)
    if status_filter == "completed":
        query = query.where(WorkerTraining.completed_on.is_not(None))
    if search:
        pattern = f"%{search.strip()}%"
        query = query.where(
            or_(
                Worker.full_name.ilike(pattern),
                TrainingCatalog.name.ilike(pattern),
                WorkerTraining.notes.ilike(pattern),
            )
        )

    rows = db.scalars(query.order_by(Worker.full_name, TrainingCatalog.display_order)).all()
    return [
        to_training_read(
            worker=row.worker,
            catalog_item=row.catalog_item,
            training=row,
        )
        for row in rows
    ]


@router.post("/records", response_model=WorkerTrainingRead)
async def upsert_training_record(
    worker_id: int = Form(...),
    catalog_id: int = Form(...),
    completed_on: str | None = Form(default=None),
    notes: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
) -> WorkerTrainingRead:
    worker = db.scalar(worker_query().where(Worker.id == worker_id))
    if worker is None:
        raise HTTPException(status_code=404, detail="Worker not found")
    catalog_item = db.get(TrainingCatalog, catalog_id)
    if catalog_item is None:
        raise HTTPException(status_code=404, detail="Training item not found")

    parsed_date: date | None = None
    if completed_on:
        try:
            parsed_date = date.fromisoformat(completed_on)
        except ValueError as error:
            raise HTTPException(status_code=400, detail="Invalid completion date") from error

    evidence_stored_name = None
    evidence_file_name = None
    evidence_file_type = None
    if file is not None:
        evidence_stored_name, evidence_file_name = await save_upload(file)
        evidence_file_type = file.content_type

    row, _, _ = upsert_training_row(
        db,
        worker_id=worker_id,
        catalog_id=catalog_id,
        completed_on=parsed_date,
        evidence_file_name=evidence_file_name,
        evidence_stored_name=evidence_stored_name,
        evidence_file_type=evidence_file_type,
        notes=notes,
    )
    db.commit()
    row = db.scalar(
        training_rows_query().where(WorkerTraining.worker_id == worker_id, WorkerTraining.catalog_id == catalog_id)
    )
    return to_training_read(worker=row.worker, catalog_item=row.catalog_item, training=row)


@router.delete("/records/{worker_id}/{catalog_id}")
def delete_training_record(worker_id: int, catalog_id: int, db: Session = Depends(get_db)) -> dict[str, str]:
    row = db.scalar(
        training_rows_query().where(WorkerTraining.worker_id == worker_id, WorkerTraining.catalog_id == catalog_id)
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Training record not found")

    if row.evidence_stored_name:
        shared_source_name = row.source_document.stored_file_name if row.source_document else None
        if row.evidence_stored_name != shared_source_name:
            file_location = Path(UPLOAD_DIR) / row.evidence_stored_name
            if file_location.exists():
                file_location.unlink()

    db.delete(row)
    db.commit()
    return {"message": "Training record removed"}


@router.get("/documents", response_model=list[SourceDocumentRead])
def list_source_documents(
    company_id: int | None = Query(default=None),
    contractor_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[SourceDocumentRead]:
    query = select(SourceDocument).join(SourceDocument.contractor).options(
        selectinload(SourceDocument.contractor).selectinload(Contractor.company),
        selectinload(SourceDocument.trainings),
    )
    if company_id:
        query = query.where(Contractor.company_id == company_id)
    if contractor_id:
        query = query.where(SourceDocument.contractor_id == contractor_id)
    documents = db.scalars(query.order_by(SourceDocument.created_at.desc())).all()
    return [to_source_document_read(document) for document in documents]


@router.post("/preview", response_model=ContractorMatrixPreview)
async def preview_training_import(
    company_id: int | None = Form(default=None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> ContractorMatrixPreview:
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    company = resolve_company(db, company_id)
    try:
        parsed = parse_contractor_matrix(file_bytes, file.filename or "document.pdf")
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    contractor = resolve_contractor(db, company, parsed.contractor_name)
    return build_preview(db, company, contractor, parsed, file.filename or "document.pdf")


@router.post("/import", response_model=ContractorMatrixImportResult, status_code=status.HTTP_201_CREATED)
async def import_training_document(
    company_id: int | None = Form(default=None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> ContractorMatrixImportResult:
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    company = resolve_company(db, company_id)
    parsed = parse_contractor_matrix(file_bytes, file.filename or "document.pdf")
    contractor = resolve_contractor(db, company, parsed.contractor_name)

    original_name = file.filename or "document.pdf"
    stored_name = f"{normalize_key(original_name).replace(' ', '-')}-{sanitize_filename(original_name)}"
    file_path = Path(UPLOAD_DIR) / stored_name
    dedupe_index = 1
    while file_path.exists():
        stored_name = (
            f"{normalize_key(original_name).replace(' ', '-')}-{dedupe_index}-{sanitize_filename(original_name)}"
        )
        file_path = Path(UPLOAD_DIR) / stored_name
        dedupe_index += 1
    file_path.write_bytes(file_bytes)

    source_document = SourceDocument(
        contractor_id=contractor.id,
        document_kind="contractor-training-matrix",
        title=original_name,
        original_file_name=original_name,
        stored_file_name=stored_name,
        file_type=file.content_type,
        completed_on=parsed.completed_on,
        notes=f"Imported from contractor matrix for {contractor.name}.",
    )
    db.add(source_document)
    db.flush()

    catalog_items, lookup = catalog_lookup(db)
    workers_by_name = worker_lookup(db, company.id)
    created_workers = 0
    updated_workers = 0
    created_trainings = 0
    updated_trainings = 0

    combined_entries = [
        *[(entry, "primary") for entry in parsed.training_records],
        *[(entry, "otros") for entry in parsed.certifications],
    ]

    for employee_name in sorted({entry.employee_name for entry, _ in combined_entries}):
        worker = workers_by_name.get(normalize_name(employee_name))
        if worker is None:
            worker = Worker(
                company_id=company.id,
                contractor_id=contractor.id,
                full_name=employee_name,
                onboarding_status="active",
                notes="Auto-created from contractor matrix import.",
            )
            db.add(worker)
            db.flush()
            workers_by_name[normalize_name(employee_name)] = db.scalar(worker_query().where(Worker.id == worker.id))
            created_workers += 1
        else:
            if worker.contractor_id != contractor.id:
                worker.contractor_id = contractor.id
                updated_workers += 1

    for entry, fallback_category in combined_entries:
        worker = workers_by_name[normalize_name(entry.employee_name)]
        catalog_item = lookup.get(normalize_catalog_key(entry.title))
        if catalog_item is None:
            catalog_item = resolve_catalog_item(db, lookup, entry.title, fallback_category)
            lookup.update(build_database_catalog_lookup(db.scalars(catalog_items_query()).all()))

        _, created, updated = upsert_training_row(
            db,
            worker_id=worker.id,
            catalog_id=catalog_item.id,
            completed_on=entry.issue_date,
            source_document_id=source_document.id,
            evidence_file_name=original_name,
            evidence_stored_name=stored_name,
            evidence_file_type=file.content_type,
            notes=f"Imported from {original_name}.",
        )
        if created:
            created_trainings += 1
        elif updated:
            updated_trainings += 1

    db.commit()

    return ContractorMatrixImportResult(
        contractor_name=contractor.name,
        source_document_id=source_document.id,
        source_document_name=original_name,
        created_workers=created_workers,
        updated_workers=updated_workers,
        created_trainings=created_trainings,
        updated_trainings=updated_trainings,
    )
