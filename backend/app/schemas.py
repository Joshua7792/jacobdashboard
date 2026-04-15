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
    certification_count: int = 0
    expiring_certifications: int = 0


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
    certification_count: int = 0


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


class CertificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    worker_id: int
    title: str
    contractor: Optional[str]
    issue_date: Optional[date]
    expiration_date: Optional[date]
    file_name: Optional[str]
    file_path: Optional[str]
    file_type: Optional[str]
    notes: Optional[str]
    created_at: datetime
    status: str = "valid"
    file_url: Optional[str] = None
    worker_name: Optional[str] = None
    company_name: Optional[str] = None
    contractor_name: Optional[str] = None


class CertificationAnalysis(BaseModel):
    detected_title: Optional[str] = None
    detected_contractor: Optional[str] = None
    detected_issue_date: Optional[date] = None
    detected_expiration_date: Optional[date] = None
    text_preview: Optional[str] = None
    analysis_source: str


class WorkerRead(WorkerBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
    company_name: str
    contractor_name: Optional[str] = None
    certification_count: int = 0
    certification_status: str = "missing"
    certifications: list[CertificationRead] = []


class DashboardMetric(BaseModel):
    label: str
    value: int


class ChartPoint(BaseModel):
    label: str
    value: int


class DashboardOverview(BaseModel):
    company_scope: str
    metrics: list[DashboardMetric]
    onboarding_trend: list[ChartPoint]
    contractor_distribution: list[ChartPoint]
    certification_health: list[ChartPoint]
    expiring_certifications: list[CertificationRead]
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


class TrainingRecordRead(BaseModel):
    id: int
    worker_id: int
    source_document_id: Optional[int] = None
    title: str
    issue_date: Optional[date] = None
    notes: Optional[str] = None
    created_at: datetime
    worker_name: Optional[str] = None
    contractor_name: Optional[str] = None
    company_name: Optional[str] = None
    source_document_name: Optional[str] = None
    source_file_url: Optional[str] = None


class SourceDocumentRead(BaseModel):
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


class MatrixEmployeePreview(BaseModel):
    employee_name: str
    matched_worker_id: Optional[int] = None
    action: str
    training_count: int
    certification_count: int


class MatrixRecordPreview(BaseModel):
    employee_name: str
    title: str
    issue_date: date
    matched_worker_id: Optional[int] = None


class ContractorMatrixPreview(BaseModel):
    contractor_name: str
    original_contractor_name: str
    company_name: str
    file_name: str
    completed_on: Optional[date] = None
    analysis_source: str
    employee_matches: list[MatrixEmployeePreview]
    training_records: list[MatrixRecordPreview]
    certifications: list[MatrixRecordPreview]


class ContractorMatrixImportResult(BaseModel):
    contractor_name: str
    source_document_id: int
    source_document_name: str
    created_workers: int
    updated_workers: int
    created_training_records: int
    updated_training_records: int
    created_certifications: int
    updated_certifications: int
