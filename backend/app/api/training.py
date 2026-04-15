from __future__ import annotations

import unicodedata
from collections import Counter

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from ..models import Certification, Company, Contractor, SourceDocument, TrainingRecord, Worker
from ..schemas import (
    ContractorMatrixImportResult,
    ContractorMatrixPreview,
    MatrixEmployeePreview,
    MatrixRecordPreview,
    SourceDocumentRead,
    TrainingRecordRead,
)
from ..services.contractor_matrix import contractor_alias, normalize_name, parse_contractor_matrix
from ..services.files import save_upload
from .deps import get_db

router = APIRouter(prefix="/training", tags=["training"])


def normalize_key(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_only = "".join(char for char in normalized if not unicodedata.combining(char))
    return " ".join(ascii_only.lower().split())


def to_training_record_read(record: TrainingRecord) -> TrainingRecordRead:
    worker = record.worker
    contractor = worker.contractor if worker else None
    company = worker.company if worker else None
    source_document = record.source_document
    return TrainingRecordRead(
        id=record.id,
        worker_id=record.worker_id,
        source_document_id=record.source_document_id,
        title=record.title,
        issue_date=record.issue_date,
        notes=record.notes,
        created_at=record.created_at,
        worker_name=worker.full_name if worker else None,
        contractor_name=contractor.name if contractor else None,
        company_name=company.name if company else None,
        source_document_name=source_document.original_file_name if source_document else None,
        source_file_url=(
            f"/uploads/{source_document.stored_file_name}"
            if source_document and source_document.stored_file_name
            else None
        ),
    )


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
    )


def resolve_company(db: Session, company_id: int | None) -> Company:
    if company_id is not None:
        company = db.get(Company, company_id)
        if company is None:
            raise HTTPException(status_code=404, detail="Company not found")
        return company

    company = db.scalar(select(Company).where(Company.name == "Jacobs"))
    if company is None:
        company = db.scalar(select(Company).order_by(Company.name))
    if company is None:
        raise HTTPException(status_code=400, detail="Create a company before importing documents")
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
    workers = db.scalars(
        select(Worker)
        .where(Worker.company_id == company_id)
        .options(selectinload(Worker.contractor), selectinload(Worker.company))
    ).all()
    return {normalize_name(worker.full_name): worker for worker in workers}


def certification_lookup(db: Session, worker_id: int) -> dict[str, Certification]:
    certifications = db.scalars(select(Certification).where(Certification.worker_id == worker_id)).all()
    return {normalize_key(certification.title): certification for certification in certifications}


def training_lookup(db: Session, worker_id: int) -> dict[str, TrainingRecord]:
    records = db.scalars(select(TrainingRecord).where(TrainingRecord.worker_id == worker_id)).all()
    return {normalize_key(record.title): record for record in records}


def build_preview(
    db: Session,
    company: Company,
    contractor: Contractor,
    parsed,
    filename: str,
) -> ContractorMatrixPreview:
    workers_by_name = worker_lookup(db, company.id)
    employee_counter: Counter[str] = Counter()
    training_counter: Counter[str] = Counter()
    certification_counter: Counter[str] = Counter()

    for entry in parsed.training_records:
        employee_counter[entry.employee_name] += 1
        training_counter[entry.employee_name] += 1
    for entry in parsed.certifications:
        employee_counter[entry.employee_name] += 1
        certification_counter[entry.employee_name] += 1

    employee_matches = [
        MatrixEmployeePreview(
            employee_name=employee_name,
            matched_worker_id=workers_by_name.get(normalize_name(employee_name)).id
            if normalize_name(employee_name) in workers_by_name
            else None,
            action="update" if normalize_name(employee_name) in workers_by_name else "create",
            training_count=training_counter[employee_name],
            certification_count=certification_counter[employee_name],
        )
        for employee_name in sorted(employee_counter)
    ]

    training_rows = [
        MatrixRecordPreview(
            employee_name=entry.employee_name,
            title=entry.title,
            issue_date=entry.issue_date,
            matched_worker_id=workers_by_name.get(normalize_name(entry.employee_name)).id
            if normalize_name(entry.employee_name) in workers_by_name
            else None,
        )
        for entry in parsed.training_records
    ]
    certification_rows = [
        MatrixRecordPreview(
            employee_name=entry.employee_name,
            title=entry.title,
            issue_date=entry.issue_date,
            matched_worker_id=workers_by_name.get(normalize_name(entry.employee_name)).id
            if normalize_name(entry.employee_name) in workers_by_name
            else None,
        )
        for entry in parsed.certifications
    ]

    return ContractorMatrixPreview(
        contractor_name=contractor.name,
        original_contractor_name=parsed.contractor_name,
        company_name=company.name,
        file_name=filename,
        completed_on=parsed.completed_on,
        analysis_source=parsed.analysis_source,
        employee_matches=employee_matches,
        training_records=training_rows,
        certifications=certification_rows,
    )


@router.get("/records", response_model=list[TrainingRecordRead])
def list_training_records(
    company_id: int | None = Query(default=None),
    contractor_id: int | None = Query(default=None),
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[TrainingRecordRead]:
    query = select(TrainingRecord).join(TrainingRecord.worker).options(
        selectinload(TrainingRecord.worker).selectinload(Worker.company),
        selectinload(TrainingRecord.worker).selectinload(Worker.contractor),
        selectinload(TrainingRecord.source_document),
    )
    if company_id:
        query = query.where(Worker.company_id == company_id)
    if contractor_id:
        query = query.where(Worker.contractor_id == contractor_id)
    if search:
        pattern = f"%{search.strip()}%"
        query = query.where(
            or_(
                TrainingRecord.title.ilike(pattern),
                Worker.full_name.ilike(pattern),
            )
        )
    records = db.scalars(query.order_by(TrainingRecord.issue_date.desc(), TrainingRecord.title)).all()
    return [to_training_record_read(record) for record in records]


@router.get("/documents", response_model=list[SourceDocumentRead])
def list_source_documents(
    company_id: int | None = Query(default=None),
    contractor_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[SourceDocumentRead]:
    query = select(SourceDocument).join(SourceDocument.contractor).options(
        selectinload(SourceDocument.contractor).selectinload(Contractor.company)
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
    try:
        parsed = parse_contractor_matrix(file_bytes, file.filename or "document.pdf")
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    contractor = resolve_contractor(db, company, parsed.contractor_name)

    file.file.seek(0)
    stored_name, original_name = await save_upload(file)
    source_document = SourceDocument(
        contractor_id=contractor.id,
        document_kind="contractor-training-matrix",
        title=file.filename or "Contractor training matrix",
        original_file_name=original_name,
        stored_file_name=stored_name,
        file_type=file.content_type,
        completed_on=parsed.completed_on,
        notes=f"Imported from contractor matrix for {contractor.name}.",
    )
    db.add(source_document)
    db.flush()

    workers_by_name = worker_lookup(db, company.id)
    created_workers = 0
    updated_workers = 0
    created_training_records = 0
    updated_training_records = 0
    created_certifications = 0
    updated_certifications = 0

    def get_or_create_worker(employee_name: str) -> Worker:
        nonlocal created_workers, updated_workers
        key = normalize_name(employee_name)
        worker = workers_by_name.get(key)
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
            db.refresh(worker)
            workers_by_name[key] = worker
            created_workers += 1
            return worker

        if worker.contractor_id != contractor.id:
            worker.contractor_id = contractor.id
            updated_workers += 1
        return worker

    for entry in parsed.training_records:
        worker = get_or_create_worker(entry.employee_name)
        records_by_title = training_lookup(db, worker.id)
        existing = records_by_title.get(normalize_key(entry.title))
        if existing is None:
            db.add(
                TrainingRecord(
                    worker_id=worker.id,
                    source_document_id=source_document.id,
                    title=entry.title,
                    issue_date=entry.issue_date,
                    notes=f"Imported from {source_document.original_file_name}.",
                )
            )
            created_training_records += 1
        else:
            if existing.issue_date is None or entry.issue_date >= existing.issue_date:
                existing.issue_date = entry.issue_date
                existing.source_document_id = source_document.id
                existing.notes = f"Updated from {source_document.original_file_name}."
                updated_training_records += 1

    for entry in parsed.certifications:
        worker = get_or_create_worker(entry.employee_name)
        certifications_by_title = certification_lookup(db, worker.id)
        existing = certifications_by_title.get(normalize_key(entry.title))
        if existing is None:
            db.add(
                Certification(
                    worker_id=worker.id,
                    title=entry.title,
                    contractor=contractor.name,
                    issue_date=entry.issue_date,
                    expiration_date=None,
                    file_name=source_document.original_file_name,
                    file_path=source_document.stored_file_name,
                    file_type=source_document.file_type,
                    notes=f"Imported from {source_document.original_file_name}.",
                )
            )
            created_certifications += 1
        else:
            if existing.issue_date is None or entry.issue_date >= existing.issue_date:
                existing.issue_date = entry.issue_date
                existing.contractor = contractor.name
                existing.file_name = source_document.original_file_name
                existing.file_path = source_document.stored_file_name
                existing.file_type = source_document.file_type
                existing.notes = f"Updated from {source_document.original_file_name}."
                updated_certifications += 1

    db.commit()
    source_document = db.scalar(
        select(SourceDocument)
        .where(SourceDocument.id == source_document.id)
        .options(selectinload(SourceDocument.contractor).selectinload(Contractor.company))
    )

    return ContractorMatrixImportResult(
        contractor_name=contractor.name,
        source_document_id=source_document.id,
        source_document_name=source_document.original_file_name or source_document.title,
        created_workers=created_workers,
        updated_workers=updated_workers,
        created_training_records=created_training_records,
        updated_training_records=updated_training_records,
        created_certifications=created_certifications,
        updated_certifications=updated_certifications,
    )
