from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Contractor
from .deps import get_db

router = APIRouter(prefix="/lookups", tags=["lookups"])


@router.get("/contractors", response_model=list[str])
def get_contractors(db: Session = Depends(get_db)) -> list[str]:
    return db.scalars(select(Contractor.name).order_by(Contractor.name)).all()
