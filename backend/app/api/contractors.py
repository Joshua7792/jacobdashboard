from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..models import Certification, Company, Contractor, Worker
from ..schemas import ContractorCreate, ContractorRead, ContractorUpdate
from .deps import get_db

router = APIRouter(prefix="/contractors", tags=["contractors"])


def to_contractor_read(contractor: Contractor) -> ContractorRead:
    certification_count = sum(len(worker.certifications) for worker in contractor.workers)
    return ContractorRead(
        id=contractor.id,
        company_id=contractor.company_id,
        name=contractor.name,
        primary_contact=contractor.primary_contact,
        notes=contractor.notes,
        company_name=contractor.company.name,
        created_at=contractor.created_at,
        updated_at=contractor.updated_at,
        worker_count=len(contractor.workers),
        certification_count=certification_count,
    )


@router.get("", response_model=list[ContractorRead])
def list_contractors(
    company_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[ContractorRead]:
    query = select(Contractor).options(
        selectinload(Contractor.company),
        selectinload(Contractor.workers).selectinload(Worker.certifications),
    )
    if company_id:
        query = query.where(Contractor.company_id == company_id)
    contractors = db.scalars(query.order_by(Contractor.name)).all()
    return [to_contractor_read(contractor) for contractor in contractors]


@router.post("", response_model=ContractorRead, status_code=status.HTTP_201_CREATED)
def create_contractor(payload: ContractorCreate, db: Session = Depends(get_db)) -> ContractorRead:
    company = db.get(Company, payload.company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")

    contractor = Contractor(**payload.model_dump())
    db.add(contractor)
    db.commit()
    contractor = db.scalar(
        select(Contractor)
        .where(Contractor.id == contractor.id)
        .options(
            selectinload(Contractor.company),
            selectinload(Contractor.workers).selectinload(Worker.certifications),
        )
    )
    return to_contractor_read(contractor)


@router.put("/{contractor_id}", response_model=ContractorRead)
def update_contractor(
    contractor_id: int,
    payload: ContractorUpdate,
    db: Session = Depends(get_db),
) -> ContractorRead:
    contractor = db.scalar(
        select(Contractor)
        .where(Contractor.id == contractor_id)
        .options(
            selectinload(Contractor.company),
            selectinload(Contractor.workers).selectinload(Worker.certifications),
        )
    )
    if contractor is None:
        raise HTTPException(status_code=404, detail="Contractor not found")

    company = db.get(Company, payload.company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")

    for field, value in payload.model_dump().items():
        setattr(contractor, field, value)

    db.commit()
    contractor = db.scalar(
        select(Contractor)
        .where(Contractor.id == contractor_id)
        .options(
            selectinload(Contractor.company),
            selectinload(Contractor.workers).selectinload(Worker.certifications),
        )
    )
    return to_contractor_read(contractor)


@router.delete("/{contractor_id}")
def delete_contractor(contractor_id: int, db: Session = Depends(get_db)) -> dict[str, str]:
    contractor = db.get(Contractor, contractor_id)
    if contractor is None:
        raise HTTPException(status_code=404, detail="Contractor not found")
    for worker in db.scalars(select(Worker).where(Worker.contractor_id == contractor_id)).all():
        worker.contractor_id = None
        for certification in worker.certifications:
            certification.contractor = None
    db.delete(contractor)
    db.commit()
    return {"message": "Contractor deleted"}
