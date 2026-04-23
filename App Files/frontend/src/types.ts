export type Company = {
  id: number
  name: string
  industry: string | null
  primary_contact: string | null
  budget_cap: number
  notes: string | null
  created_at: string
  updated_at: string
  worker_count: number
  contractor_count: number
  training_count: number
  trainings_completed: number
  budget_used: number
  budget_remaining: number
  budget_pct: number
}

export type Contractor = {
  id: number
  company_id: number
  company_name: string
  name: string
  primary_contact: string | null
  budget_allocated: number
  notes: string | null
  created_at: string
  updated_at: string
  worker_count: number
  trainings_completed: number
  trainings_required: number
  compliance_pct: number
}

export type TrainingCatalog = {
  id: number
  name: string
  category: string
  display_order: number
  aliases: string | null
  notes: string | null
}

export type WorkerTraining = {
  id: number | null
  worker_id: number
  catalog_id: number
  catalog_name: string
  category: string
  display_order: number
  completed_on: string | null
  source_document_id: number | null
  source_document_name: string | null
  evidence_file_name: string | null
  evidence_file_type: string | null
  evidence_url: string | null
  notes: string | null
  status: string
  worker_name: string | null
  contractor_name: string | null
  company_name: string | null
  created_at: string | null
  updated_at: string | null
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
  training_count: number
}

export type MatrixEmployeePreview = {
  employee_name: string
  matched_worker_id: number | null
  action: string
  training_count: number
}

export type MatrixRecordPreview = {
  employee_name: string
  catalog_name: string
  catalog_id: number | null
  category: string
  completed_on: string
  matched_worker_id: number | null
}

export type ContractorMatrixPreview = {
  contractor_name: string
  original_contractor_name: string
  company_name: string
  file_name: string
  completed_on: string | null
  analysis_source: string
  language: string
  employee_matches: MatrixEmployeePreview[]
  trainings: MatrixRecordPreview[]
  unknown_columns: string[]
}

export type ContractorMatrixImportResult = {
  contractor_name: string
  source_document_id: number
  source_document_name: string
  created_workers: number
  updated_workers: number
  created_trainings: number
  updated_trainings: number
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
  trainings_completed: number
  trainings_required: number
  compliance_pct: number
  compliance_status: string
  trainings: WorkerTraining[]
}

export type DashboardMetric = {
  label: string
  value: number
  sub_label: string | null
}

export type ChartPoint = {
  label: string
  value: number
}

export type DashboardOverview = {
  company_scope: string
  metrics: DashboardMetric[]
  contractor_compliance: ChartPoint[]
  training_coverage: ChartPoint[]
  recent_imports: SourceDocument[]
  recent_workers: Worker[]
}

export type ReportPreview = {
  title: string
  dataset: string
  group_by: string
  rows: ChartPoint[]
}

export type ContractorName = string
