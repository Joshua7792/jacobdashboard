from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from .config import DEFAULT_COMPANY_NAME, DEFAULT_CONTRACTORS, DEMO_CONTRACTOR_MAPPINGS, LEGACY_DEMO_COMPANY_NAMES
from .models import Certification, Company, Contractor, Worker


def ensure_default_contractors(session: Session, company_id: int) -> dict[str, Contractor]:
    existing = session.scalars(
        select(Contractor).where(Contractor.company_id == company_id).order_by(Contractor.name)
    ).all()
    by_name = {contractor.name: contractor for contractor in existing}

    for contractor_name in DEFAULT_CONTRACTORS:
        if contractor_name not in by_name:
            contractor = Contractor(
                company_id=company_id,
                name=contractor_name,
            )
            session.add(contractor)
            session.flush()
            by_name[contractor.name] = contractor

    return by_name


def _insert_demo_workers_and_certifications(session: Session, company_id: int) -> None:
    contractors = ensure_default_contractors(session, company_id)
    workers = [
        Worker(
            company_id=company_id,
            contractor_id=contractors["GeoEnvirotech"].id,
            full_name="Alicia Gomez",
            employee_code="AT-101",
            job_title="Site Coordinator",
            onboarding_status="new",
            hire_date=date.today() - timedelta(days=7),
            email="alicia@example.com",
        ),
        Worker(
            company_id=company_id,
            contractor_id=contractors["GeoEnvirotech"].id,
            full_name="Luis Martinez",
            employee_code="AT-102",
            job_title="Safety Technician",
            onboarding_status="active",
            hire_date=date.today() - timedelta(days=110),
            email="luis@example.com",
        ),
        Worker(
            company_id=company_id,
            contractor_id=contractors["Cornerstone"].id,
            full_name="Sofia Bennett",
            employee_code="SE-210",
            job_title="Journeyman Electrician",
            onboarding_status="active",
            hire_date=date.today() - timedelta(days=60),
            email="sofia@example.com",
        ),
        Worker(
            company_id=company_id,
            contractor_id=contractors["Cornerstone"].id,
            full_name="Noah Patel",
            employee_code="SE-211",
            job_title="Foreman",
            onboarding_status="active",
            hire_date=date.today() - timedelta(days=20),
            email="noah@example.com",
        ),
        Worker(
            company_id=company_id,
            contractor_id=contractors["Cornerstone"].id,
            full_name="Mia Torres",
            employee_code="HM-301",
            job_title="Pipefitter",
            onboarding_status="active",
            hire_date=date.today() - timedelta(days=180),
            email="mia@example.com",
        ),
    ]
    session.add_all(workers)
    session.flush()

    certifications = [
        Certification(
            worker_id=workers[0].id,
            title="OSHA 30",
            contractor="GeoEnvirotech",
            issue_date=date.today() - timedelta(days=20),
            expiration_date=date.today() + timedelta(days=320),
            file_name="osha30-alicia.pdf",
            file_path="demo/osha30-alicia.pdf",
            file_type="application/pdf",
        ),
        Certification(
            worker_id=workers[1].id,
            title="Confined Space",
            contractor="GeoEnvirotech",
            issue_date=date.today() - timedelta(days=320),
            expiration_date=date.today() + timedelta(days=12),
            file_name="confined-luis.pdf",
            file_path="demo/confined-luis.pdf",
            file_type="application/pdf",
        ),
        Certification(
            worker_id=workers[2].id,
            title="NFPA 70E",
            contractor="Cornerstone",
            issue_date=date.today() - timedelta(days=300),
            expiration_date=date.today() - timedelta(days=8),
            file_name="nfpa-sofia.pdf",
            file_path="demo/nfpa-sofia.pdf",
            file_type="application/pdf",
        ),
        Certification(
            worker_id=workers[3].id,
            title="Lift Training",
            contractor="Cornerstone",
            issue_date=date.today() - timedelta(days=40),
            expiration_date=date.today() + timedelta(days=180),
            file_name="lift-noah.pdf",
            file_path="demo/lift-noah.pdf",
            file_type="application/pdf",
        ),
        Certification(
            worker_id=workers[4].id,
            title="Rigging Basics",
            contractor="Cornerstone",
            issue_date=date.today() - timedelta(days=85),
            expiration_date=None,
            file_name="rigging-mia.pdf",
            file_path="demo/rigging-mia.pdf",
            file_type="application/pdf",
        ),
    ]
    session.add_all(certifications)
    session.flush()


def seed_demo_data(session: Session) -> None:
    existing_company = session.scalar(select(Company.id).limit(1))
    if existing_company:
        return

    jacobs = Company(
        name=DEFAULT_COMPANY_NAME,
        industry="Engineering and Construction",
        primary_contact="Project Coordination Team",
        notes="Jacobs project workforce tracking across active contractors.",
    )
    session.add(jacobs)
    session.flush()

    _insert_demo_workers_and_certifications(session, jacobs.id)


def normalize_demo_contractors(session: Session) -> None:
    certifications = session.scalars(select(Certification)).all()
    changed = False

    for certification in certifications:
        mapped_name = DEMO_CONTRACTOR_MAPPINGS.get(certification.contractor or "")
        if mapped_name and certification.contractor != mapped_name:
            certification.contractor = mapped_name
            changed = True

    if changed:
        session.flush()


def normalize_demo_companies(session: Session) -> None:
    companies = session.scalars(select(Company).order_by(Company.id)).all()
    if not companies:
        return

    jacobs = next((company for company in companies if company.name == DEFAULT_COMPANY_NAME), None)
    if jacobs is None:
        jacobs = Company(
            name=DEFAULT_COMPANY_NAME,
            industry="Engineering and Construction",
            primary_contact="Project Coordination Team",
            notes="Jacobs project workforce tracking across active contractors.",
        )
        session.add(jacobs)
        session.flush()

    legacy_companies = [
        company
        for company in companies
        if company.name in LEGACY_DEMO_COMPANY_NAMES and company.id != jacobs.id
    ]

    changed = False
    for legacy_company in legacy_companies:
        session.execute(
            update(Worker)
            .where(Worker.company_id == legacy_company.id)
            .values(company_id=jacobs.id)
        )
        session.delete(legacy_company)
        changed = True

    if not jacobs.industry:
        jacobs.industry = "Engineering and Construction"
        changed = True
    if not jacobs.primary_contact:
        jacobs.primary_contact = "Project Coordination Team"
        changed = True
    if not jacobs.notes:
        jacobs.notes = "Jacobs project workforce tracking across active contractors."
        changed = True

    if changed:
        session.flush()


def ensure_jacobs_demo_dataset(session: Session) -> None:
    jacobs = session.scalar(select(Company).where(Company.name == DEFAULT_COMPANY_NAME))
    worker_count = session.scalar(select(Worker.id).where(Worker.company_id == jacobs.id).limit(1)) if jacobs else None

    if jacobs is not None and worker_count is None:
        _insert_demo_workers_and_certifications(session, jacobs.id)


def remove_duplicate_demo_workers(session: Session) -> None:
    jacobs = session.scalar(select(Company).where(Company.name == DEFAULT_COMPANY_NAME))
    if jacobs is None:
        return

    demo_codes = {"AT-101", "AT-102", "SE-210", "SE-211", "HM-301"}
    workers = session.scalars(
        select(Worker)
        .where(Worker.company_id == jacobs.id, Worker.employee_code.in_(demo_codes))
        .order_by(Worker.employee_code, Worker.id)
    ).all()

    seen_codes: set[str] = set()
    duplicate_ids: list[int] = []
    for worker in workers:
        code = worker.employee_code or ""
        if code in seen_codes:
            duplicate_ids.append(worker.id)
        else:
            seen_codes.add(code)

    if duplicate_ids:
        session.execute(delete(Worker).where(Worker.id.in_(duplicate_ids)))
        session.flush()


def normalize_demo_worker_contractors(session: Session) -> None:
    workers = session.scalars(
        select(Worker)
        .options()
        .order_by(Worker.id)
    ).all()
    companies = session.scalars(select(Company)).all()
    contractor_maps = {
        company.id: ensure_default_contractors(session, company.id)
        for company in companies
    }

    changed = False
    for worker in workers:
        worker_contractors = [
            certification.contractor
            for certification in worker.certifications
            if certification.contractor
        ]
        target_name = worker_contractors[0] if worker_contractors else None
        if target_name and worker.company_id in contractor_maps and target_name in contractor_maps[worker.company_id]:
            target_id = contractor_maps[worker.company_id][target_name].id
            if worker.contractor_id != target_id:
                worker.contractor_id = target_id
                changed = True

    if changed:
        session.flush()
