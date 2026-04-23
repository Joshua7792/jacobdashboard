from __future__ import annotations

from datetime import date

from sqlalchemy import inspect, select, text
from sqlalchemy.orm import Session

from .config import (
    DEFAULT_COMPANY_NAME,
    DEFAULT_CONTRACTORS,
    LEGACY_DEMO_COMPANY_NAMES,
    TRAINING_CATALOG,
    CATEGORY_OTROS,
    CATEGORY_PRIMARY,
)
from .models import Company, Contractor, TrainingCatalog, WorkerTraining
from .services.catalog import build_database_catalog_lookup, normalize_catalog_key, serialize_aliases


def ensure_project_company(session: Session) -> Company:
    companies = session.scalars(select(Company).order_by(Company.id)).all()
    project = next((company for company in companies if company.name == DEFAULT_COMPANY_NAME), None)

    if project is None and len(companies) == 1:
        project = companies[0]
        project.name = DEFAULT_COMPANY_NAME

    if project is None:
        project = Company(
            name=DEFAULT_COMPANY_NAME,
            industry="Engineering and Construction Management",
            primary_contact="Project Coordination Team",
            budget_cap=200_000_000,
            notes="Cordillera project workforce tracking across active contractors.",
        )
        session.add(project)
        session.flush()

    if not project.industry:
        project.industry = "Engineering and Construction Management"
    if not project.primary_contact:
        project.primary_contact = "Project Coordination Team"
    if not project.budget_cap:
        project.budget_cap = 200_000_000
    if not project.notes:
        project.notes = "Cordillera project workforce tracking across active contractors."

    for company in companies:
        if company.id != project.id and company.name in LEGACY_DEMO_COMPANY_NAMES:
            session.delete(company)

    session.flush()
    return project


def ensure_default_contractors(session: Session, company_id: int) -> dict[str, Contractor]:
    existing = session.scalars(
        select(Contractor).where(Contractor.company_id == company_id).order_by(Contractor.name)
    ).all()
    by_name = {contractor.name: contractor for contractor in existing}

    for contractor_name in DEFAULT_CONTRACTORS:
        if contractor_name not in by_name:
            contractor = Contractor(company_id=company_id, name=contractor_name)
            session.add(contractor)
            session.flush()
            by_name[contractor.name] = contractor

    return by_name


def ensure_training_catalog(session: Session) -> list[TrainingCatalog]:
    existing = session.scalars(select(TrainingCatalog).order_by(TrainingCatalog.display_order)).all()
    by_name = {item.name: item for item in existing}

    for entry in TRAINING_CATALOG:
        aliases = serialize_aliases(entry.get("aliases", []))
        catalog_item = by_name.get(entry["name"])
        if catalog_item is None:
            catalog_item = TrainingCatalog(
                name=entry["name"],
                category=entry["category"],
                display_order=entry["order"],
                aliases=aliases,
            )
            session.add(catalog_item)
            session.flush()
            by_name[catalog_item.name] = catalog_item
        else:
            catalog_item.category = entry["category"]
            catalog_item.display_order = entry["order"]
            catalog_item.aliases = aliases

    session.flush()
    return session.scalars(select(TrainingCatalog).order_by(TrainingCatalog.display_order, TrainingCatalog.id)).all()


def ensure_catalog_item(
    session: Session,
    lookup: dict[str, TrainingCatalog],
    title: str,
    category: str,
) -> TrainingCatalog:
    normalized = normalize_catalog_key(title)
    if normalized in lookup:
        return lookup[normalized]

    max_order = session.scalar(select(TrainingCatalog.display_order).order_by(TrainingCatalog.display_order.desc()).limit(1)) or 0
    catalog_item = TrainingCatalog(
        name=title.strip(),
        category=category,
        display_order=max_order + 1,
    )
    session.add(catalog_item)
    session.flush()
    lookup[normalized] = catalog_item
    return catalog_item


def upsert_worker_training(
    session: Session,
    existing_rows: dict[tuple[int, int], WorkerTraining],
    *,
    worker_id: int,
    catalog_id: int,
    completed_on,
    source_document_id=None,
    evidence_file_name=None,
    evidence_stored_name=None,
    evidence_file_type=None,
    notes=None,
) -> tuple[WorkerTraining, bool, bool]:
    if isinstance(completed_on, str) and completed_on:
        completed_on = date.fromisoformat(completed_on)

    key = (worker_id, catalog_id)
    row = existing_rows.get(key)
    created = False
    updated = False

    if row is None:
        row = WorkerTraining(worker_id=worker_id, catalog_id=catalog_id)
        session.add(row)
        session.flush()
        existing_rows[key] = row
        created = True

    if completed_on and row.completed_on != completed_on:
        row.completed_on = completed_on
        updated = True
    if source_document_id and row.source_document_id != source_document_id:
        row.source_document_id = source_document_id
        updated = True
    if evidence_file_name and row.evidence_file_name != evidence_file_name:
        row.evidence_file_name = evidence_file_name
        updated = True
    if evidence_stored_name and row.evidence_stored_name != evidence_stored_name:
        row.evidence_stored_name = evidence_stored_name
        updated = True
    if evidence_file_type and row.evidence_file_type != evidence_file_type:
        row.evidence_file_type = evidence_file_type
        updated = True
    if notes and row.notes != notes:
        row.notes = notes
        updated = True

    return row, created, updated


def migrate_legacy_training_data(session: Session) -> None:
    inspector = inspect(session.bind)
    tables = set(inspector.get_table_names())
    if "workers" not in tables:
        return

    catalog_items = ensure_training_catalog(session)
    catalog_lookup = build_database_catalog_lookup(catalog_items)
    existing_rows = {
        (row.worker_id, row.catalog_id): row
        for row in session.scalars(select(WorkerTraining)).all()
    }

    def catalog_for_title(title: str, category: str) -> TrainingCatalog:
        normalized = normalize_catalog_key(title)
        catalog_item = catalog_lookup.get(normalized)
        if catalog_item is None:
            catalog_item = build_database_catalog_lookup(ensure_training_catalog(session)).get(normalized)
        if catalog_item is None:
            catalog_item = ensure_catalog_item(session, catalog_lookup, title, category)
            catalog_lookup.update(build_database_catalog_lookup(ensure_training_catalog(session)))
        return catalog_item

    if "training_records" in tables:
        training_rows = session.execute(
            text(
                """
                SELECT worker_id, source_document_id, title, issue_date, notes
                FROM training_records
                ORDER BY worker_id, id
                """
            )
        ).mappings()
        for row in training_rows:
            catalog_item = catalog_for_title(row["title"], CATEGORY_PRIMARY)
            upsert_worker_training(
                session,
                existing_rows,
                worker_id=row["worker_id"],
                catalog_id=catalog_item.id,
                completed_on=row["issue_date"],
                source_document_id=row["source_document_id"],
                notes=row["notes"],
            )

    if "certifications" in tables:
        certification_rows = session.execute(
            text(
                """
                SELECT worker_id, title, issue_date, file_name, file_path, file_type, notes
                FROM certifications
                ORDER BY worker_id, id
                """
            )
        ).mappings()
        for row in certification_rows:
            catalog_item = catalog_for_title(row["title"], CATEGORY_OTROS)
            upsert_worker_training(
                session,
                existing_rows,
                worker_id=row["worker_id"],
                catalog_id=catalog_item.id,
                completed_on=row["issue_date"],
                evidence_file_name=row["file_name"],
                evidence_stored_name=row["file_path"],
                evidence_file_type=row["file_type"],
                notes=row["notes"],
            )

    session.flush()
