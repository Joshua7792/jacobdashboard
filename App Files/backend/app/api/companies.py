from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..models import Company, TrainingCatalog, Worker
from ..schemas import CompanyCreate, CompanyRead, CompanyUpdate
from .deps import get_db
from .serializers import company_training_counts

router = APIRouter(prefix="/companies", tags=["companies"])


def to_company_read(company: Company, catalog_items: list[TrainingCatalog]) -> CompanyRead:
    completed, required = company_training_counts(company, catalog_items)
    budget_used = sum(contractor.budget_allocated or 0 for contractor in company.contractors)
    budget_remaining = (company.budget_cap or 0) - budget_used
    budget_pct = round((budget_used / company.budget_cap) * 100) if company.budget_cap else 0
    return CompanyRead(
        id=company.id,
        name=company.name,
        industry=company.industry,
        primary_contact=company.primary_contact,
        budget_cap=company.budget_cap,
        notes=company.notes,
        created_at=company.created_at,
        updated_at=company.updated_at,
        worker_count=len(company.workers),
        contractor_count=len(company.contractors),
        training_count=required,
        trainings_completed=completed,
        budget_used=budget_used,
        budget_remaining=budget_remaining,
        budget_pct=budget_pct,
    )


@router.get("", response_model=list[CompanyRead])
def list_companies(db: Session = Depends(get_db)) -> list[CompanyRead]:
    companies = db.scalars(
        select(Company)
        .options(selectinload(Company.workers).selectinload(Worker.trainings))
        .options(selectinload(Company.contractors))
    ).all()
    catalog_items = db.scalars(select(TrainingCatalog).order_by(TrainingCatalog.display_order)).all()
    return [to_company_read(company, catalog_items) for company in companies]


@router.post("", response_model=CompanyRead, status_code=status.HTTP_201_CREATED)
def create_company(payload: CompanyCreate, db: Session = Depends(get_db)) -> CompanyRead:
    company = Company(**payload.model_dump())
    db.add(company)
    db.commit()
    db.refresh(company)
    company.workers = []
    company.contractors = []
    catalog_items = db.scalars(select(TrainingCatalog).order_by(TrainingCatalog.display_order)).all()
    return to_company_read(company, catalog_items)


@router.put("/{company_id}", response_model=CompanyRead)
def update_company(company_id: int, payload: CompanyUpdate, db: Session = Depends(get_db)) -> CompanyRead:
    company = db.scalar(
        select(Company)
        .where(Company.id == company_id)
        .options(selectinload(Company.workers).selectinload(Worker.trainings))
        .options(selectinload(Company.contractors))
    )
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")

    for field, value in payload.model_dump().items():
        setattr(company, field, value)

    db.commit()
    company = db.scalar(
        select(Company)
        .where(Company.id == company_id)
        .options(selectinload(Company.workers).selectinload(Worker.trainings))
        .options(selectinload(Company.contractors))
    )
    catalog_items = db.scalars(select(TrainingCatalog).order_by(TrainingCatalog.display_order)).all()
    return to_company_read(company, catalog_items)


@router.delete("/{company_id}")
def delete_company(company_id: int, db: Session = Depends(get_db)) -> dict[str, str]:
    company = db.get(Company, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    db.delete(company)
    db.commit()
    return {"message": "Company deleted"}
