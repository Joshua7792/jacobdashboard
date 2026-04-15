export type Company = {
  id: number
  name: string
  industry: string | null
  primary_contact: string | null
  notes: string | null
  created_at: string
  updated_at: string
  worker_count: number
  contractor_count: number
  certification_count: number
  expiring_certifications: number
}

export type Contractor = {
  id: number
  company_id: number
  company_name: string
  name: string
  primary_contact: string | null
  notes: string | null
  created_at: string
  updated_at: string
  worker_count: number
  certification_count: number
}

export type Certification = {
  id: number
  worker_id: number
  title: string
  contractor: string | null
  issue_date: string | null
  expiration_date: string | null
  file_name: string | null
  file_path: string | null
  file_type: string | null
  notes: string | null
  created_at: string
  status: string
  file_url: string | null
  worker_name: string | null
  company_name: string | null
}

export type CertificationAnalysis = {
  detected_title: string | null
  detected_contractor: string | null
  detected_issue_date: string | null
  detected_expiration_date: string | null
  text_preview: string | null
  analysis_source: string
}

export type TrainingRecord = {
  id: number
  worker_id: number
  source_document_id: number | null
  title: string
  issue_date: string | null
  notes: string | null
  created_at: string
  worker_name: string | null
  contractor_name: string | null
  company_name: string | null
  source_document_name: string | null
  source_file_url: string | null
}

export type SourceDocument = {
  id: number
  contractor_id: number
  contractor_name: string
  company_name: string
  document_kind: string
  title: string
  original_file_name: string | null
  file_type: string | null
  completed_on: string | null
  created_at: string
  file_url: string | null
}

export type MatrixEmployeePreview = {
  employee_name: string
  matched_worker_id: number | null
  action: string
  training_count: number
  certification_count: number
}

export type MatrixRecordPreview = {
  employee_name: string
  title: string
  issue_date: string
  matched_worker_id: number | null
}

export type ContractorMatrixPreview = {
  contractor_name: string
  original_contractor_name: string
  company_name: string
  file_name: string
  completed_on: string | null
  analysis_source: string
  employee_matches: MatrixEmployeePreview[]
  training_records: MatrixRecordPreview[]
  certifications: MatrixRecordPreview[]
}

export type ContractorMatrixImportResult = {
  contractor_name: string
  source_document_id: number
  source_document_name: string
  created_workers: number
  updated_workers: number
  created_training_records: number
  updated_training_records: number
  created_certifications: number
  updated_certifications: number
}

export type Worker = {
  id: number
  company_id: number
  contractor_id: number | null
  company_name: string
  contractor_name: string | null
  full_name: string
  employee_code: string | null
  job_title: string | null
  onboarding_status: string
  hire_date: string | null
  email: string | null
  phone: string | null
  notes: string | null
  created_at: string
  updated_at: string
  certification_count: number
  certification_status: string
  certifications: Certification[]
}

export type DashboardMetric = {
  label: string
  value: number
}

export type ChartPoint = {
  label: string
  value: number
}

export type DashboardOverview = {
  company_scope: string
  metrics: DashboardMetric[]
  onboarding_trend: ChartPoint[]
  contractor_distribution: ChartPoint[]
  certification_health: ChartPoint[]
  expiring_certifications: Certification[]
  recent_workers: Worker[]
}

export type ReportPreview = {
  title: string
  dataset: string
  group_by: string
  rows: ChartPoint[]
}

export type ContractorName = string
