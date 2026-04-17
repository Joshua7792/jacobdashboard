from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, index=True)
    industry: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    primary_contact: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    budget_cap: Mapped[int] = mapped_column(BigInteger, default=200_000_000, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    workers: Mapped[list["Worker"]] = relationship(
        back_populates="company",
        cascade="all, delete-orphan",
        order_by="Worker.full_name",
    )
    contractors: Mapped[list["Contractor"]] = relationship(
        back_populates="company",
        cascade="all, delete-orphan",
        order_by="Contractor.name",
    )


class Contractor(Base):
    __tablename__ = "contractors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(150), index=True)
    primary_contact: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    budget_allocated: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    company: Mapped["Company"] = relationship(back_populates="contractors")
    workers: Mapped[list["Worker"]] = relationship(
        back_populates="contractor",
        order_by="Worker.full_name",
    )
    source_documents: Mapped[list["SourceDocument"]] = relationship(
        back_populates="contractor",
        cascade="all, delete-orphan",
        order_by="desc(SourceDocument.created_at)",
    )


class Worker(Base):
    __tablename__ = "workers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    contractor_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("contractors.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    full_name: Mapped[str] = mapped_column(String(150), index=True)
    employee_code: Mapped[Optional[str]] = mapped_column(String(80), nullable=True, index=True)
    job_title: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    onboarding_status: Mapped[str] = mapped_column(String(40), default="active", nullable=False)
    hire_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    company: Mapped["Company"] = relationship(back_populates="workers")
    contractor: Mapped[Optional["Contractor"]] = relationship(back_populates="workers")
    trainings: Mapped[list["WorkerTraining"]] = relationship(
        back_populates="worker",
        cascade="all, delete-orphan",
        order_by="WorkerTraining.catalog_id",
    )


class TrainingCatalog(Base):
    __tablename__ = "training_catalog"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    category: Mapped[str] = mapped_column(String(40), index=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, index=True)
    aliases: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    trainings: Mapped[list["WorkerTraining"]] = relationship(back_populates="catalog_item")


class SourceDocument(Base):
    __tablename__ = "source_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    contractor_id: Mapped[int] = mapped_column(ForeignKey("contractors.id", ondelete="CASCADE"), index=True)
    document_kind: Mapped[str] = mapped_column(String(80), index=True)
    title: Mapped[str] = mapped_column(String(180))
    original_file_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    stored_file_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    file_type: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    completed_on: Mapped[Optional[date]] = mapped_column(Date, nullable=True, index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    contractor: Mapped["Contractor"] = relationship(back_populates="source_documents")
    trainings: Mapped[list["WorkerTraining"]] = relationship(
        back_populates="source_document",
        order_by="desc(WorkerTraining.updated_at)",
    )


class WorkerTraining(Base):
    __tablename__ = "worker_trainings"
    __table_args__ = (
        UniqueConstraint("worker_id", "catalog_id", name="uq_worker_catalog"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    worker_id: Mapped[int] = mapped_column(
        ForeignKey("workers.id", ondelete="CASCADE"),
        index=True,
    )
    catalog_id: Mapped[int] = mapped_column(
        ForeignKey("training_catalog.id", ondelete="CASCADE"),
        index=True,
    )
    source_document_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("source_documents.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    completed_on: Mapped[Optional[date]] = mapped_column(Date, nullable=True, index=True)
    evidence_file_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    evidence_stored_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    evidence_file_type: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    worker: Mapped["Worker"] = relationship(back_populates="trainings")
    catalog_item: Mapped["TrainingCatalog"] = relationship(back_populates="trainings")
    source_document: Mapped[Optional["SourceDocument"]] = relationship(back_populates="trainings")
