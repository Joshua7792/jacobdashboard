from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..models import Company, Contractor, Worker
from ..schemas import CompanyCreate, CompanyRead, CompanyUpdate
from .deps import get_db

router = APIRouter(prefix="/companies", tags=["companies"])


def to_company_read(company: Company) -> CompanyRead:
    today = date.today()
    expiring_cutoff = today + timedelta(days=30)
    certifications = [cert for worker in company.workers for cert in worker.certifications]
    expiring = [
        cert
        for cert in certifications
        if cert.expiration_date is not None and today <= cert.expiration_date <= expiring_cutoff
    ]
    return CompanyRead(
        id=company.id,
        name=company.name,
        industry=company.industry,
        primary_contact=company.primary_contact,
        notes=company.notes,
        created_at=company.created_at,
        updated_at=company.updated_at,
        worker_count=len(company.workers),
        contractor_count=len(company.contractors),
        certification_count=len(certifications),
        expiring_certifications=len(expiring),
    )


@router.get("", response_model=list[CompanyRead])
def list_companies(db: Session = Depends(get_db)) -> list[CompanyRead]:
    companies = db.scalars(
        select(Company).options(selectinload(Company.workers).selectinload(Worker.certifications))
        .options(selectinload(Company.contractors))
    ).all()
    return [to_company_read(company) for company in companies]


@router.post("", response_model=CompanyRead, status_code=status.HTTP_201_CREATED)
def create_company(payload: CompanyCreate, db: Session = Depends(get_db)) -> CompanyRead:
    company = Company(**payload.model_dump())
    db.add(company)
    db.commit()
    db.refresh(company)
    company.workers = []
    return to_company_read(company)


@router.put("/{company_id}", response_model=CompanyRead)
def update_company(company_id: int, payload: CompanyUpdate, db: Session = Depends(get_db)) -> CompanyRead:
    company = db.scalar(
        select(Company)
        .where(Company.id == company_id)
        .options(selectinload(Company.workers).selectinload(Worker.certifications))
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
        .options(selectinload(Company.workers).selectinload(Worker.certifications))
        .options(selectinload(Company.contractors))
    )
    return to_company_read(company)


@router.delete("/{company_id}")
def delete_company(company_id: int, db: Session = Depends(get_db)) -> dict[str, str]:
    company = db.get(Company, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    db.delete(company)
    db.commit()
    return {"message": "Company deleted"}
