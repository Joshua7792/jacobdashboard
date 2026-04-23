from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class CompanyBase(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    industry: Optional[str] = Field(default=None, max_length=120)
    primary_contact: Optional[str] = Field(default=None, max_length=120)
    notes: Optional[str] = None


class CompanyCreate(CompanyBase):
    pass


class CompanyUpdate(CompanyBase):
    pass


class CompanyRead(CompanyBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
    worker_count: int = 0
    contractor_count: int = 0
    training_count: int = 0
    trainings_completed: int = 0


class ContractorBase(BaseModel):
    company_id: int
    name: str = Field(min_length=2, max_length=150)
    primary_contact: Optional[str] = Field(default=None, max_length=120)
    notes: Optional[str] = None


class ContractorCreate(ContractorBase):
    pass


class ContractorUpdate(ContractorBase):
    pass


class ContractorRead(ContractorBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company_name: str
    created_at: datetime
    updated_at: datetime
    worker_count: int = 0
    trainings_completed: int = 0
    trainings_required: int = 0
    compliance_pct: int = 0


class WorkerBase(BaseModel):
    company_id: int
    contractor_id: Optional[int] = None
    full_name: str = Field(min_length=2, max_length=150)
    employee_code: Optional[str] = Field(default=None, max_length=80)
    job_title: Optional[str] = Field(default=None, max_length=120)
    onboarding_status: str = Field(default="active", max_length=40)
    hire_date: Optional[date] = None
    email: Optional[str] = Field(default=None, max_length=160)
    phone: Optional[str] = Field(default=None, max_length=60)
    notes: Optional[str] = None


class WorkerCreate(WorkerBase):
    pass


class WorkerUpdate(WorkerBase):
    pass


class TrainingCatalogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str
    display_order: int
    aliases: Optional[str] = None
    notes: Optional[str] = None


class WorkerTrainingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Optional[int] = None
    worker_id: int
    catalog_id: int
    catalog_name: str
    category: str
    display_order: int
    completed_on: Optional[date] = None
    source_document_id: Optional[int] = None
    source_document_name: Optional[str] = None
    evidence_file_name: Optional[str] = None
    evidence_file_type: Optional[str] = None
    evidence_url: Optional[str] = None
    notes: Optional[str] = None
    status: str = "pending"
    worker_name: Optional[str] = None
    contractor_name: Optional[str] = None
    company_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class WorkerTrainingUpsert(BaseModel):
    worker_id: int
    catalog_id: int
    completed_on: Optional[date] = None
    notes: Optional[str] = None


class WorkerRead(WorkerBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
    company_name: str
    contractor_name: Optional[str] = None
    trainings_completed: int = 0
    trainings_required: int = 0
    compliance_pct: int = 0
    compliance_status: str = "missing"
    trainings: list[WorkerTrainingRead] = []


class DashboardMetric(BaseModel):
    label: str
    value: int
    sub_label: Optional[str] = None


class ChartPoint(BaseModel):
    label: str
    value: int


class SourceDocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    contractor_id: int
    contractor_name: str
    company_name: str
    document_kind: str
    title: str
    original_file_name: Optional[str] = None
    file_type: Optional[str] = None
    completed_on: Optional[date] = None
    created_at: datetime
    file_url: Optional[str] = None
    training_count: int = 0


class DashboardOverview(BaseModel):
    company_scope: str
    metrics: list[DashboardMetric]
    contractor_compliance: list[ChartPoint]
    training_coverage: list[ChartPoint]
    recent_imports: list[SourceDocumentRead]
    recent_workers: list[WorkerRead]


class ReportRequest(BaseModel):
    dataset: str
    group_by: str
    company_id: Optional[int] = None
    filter_value: Optional[str] = None


class ReportPreview(BaseModel):
    title: str
    dataset: str
    group_by: str
    rows: list[ChartPoint]


class MatrixEmployeePreview(BaseModel):
    employee_name: str
    matched_worker_id: Optional[int] = None
    action: str
    training_count: int


class MatrixRecordPreview(BaseModel):
    employee_name: str
    catalog_name: str
    catalog_id: Optional[int] = None
    category: str
    completed_on: date
    matched_worker_id: Optional[int] = None


class ContractorMatrixPreview(BaseModel):
    contractor_name: str
    original_contractor_name: str
    company_name: str
    file_name: str
    completed_on: Optional[date] = None
    analysis_source: str
    language: str
    employee_matches: list[MatrixEmployeePreview]
    trainings: list[MatrixRecordPreview]
    unknown_columns: list[str] = []


class ContractorMatrixImportResult(BaseModel):
    contractor_name: str
    source_document_id: int
    source_document_name: str
    created_workers: int
    updated_workers: int
    created_trainings: int
    updated_trainings: int
