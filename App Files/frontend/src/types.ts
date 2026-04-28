// TypeScript shapes for the JSON payload from /api/excel/*.
//
// The backend (services/excel_reader.py) parses the workbook into Python
// dataclasses, and FastAPI's jsonable_encoder serializes them. These types
// MUST stay in sync with that dataclass schema — when you add a field on
// the Python side, mirror it here so the frontend can use it.

export type ExcelStatus = 'green' | 'yellow' | 'red' | 'blank'

export type ExcelKPIs = {
  total_contractors: number
  total_workers: number
  active_workers: number
  total_certs: number
  overall_compliance_pct: number
  green_count: number
  yellow_count: number
  red_count: number
  blank_count: number
  today: string
}

export type ExcelCertStatus = {
  cert_name: string
  cert_category: string
  completed_on: string | null
  anniversary: string | null
  days_until_anniversary: number | null
  status: ExcelStatus
}

export type ExcelWorker = {
  name: string
  contractor: string
  job_title: string | null
  status: string
  employee_code: string | null
  hire_date: string | null
  email: string | null
  phone: string | null
  notes: string | null
  certs: ExcelCertStatus[]
  compliance_pct: number
  green_count: number
  yellow_count: number
  red_count: number
  blank_count: number
}

export type ExcelContractor = {
  name: string
  primary_contact: string | null
  specialty: string | null
  notes: string | null
  worker_count: number
  compliance_pct: number
  green_count: number
  yellow_count: number
  red_count: number
  blank_count: number
  weakest_cert: string | null
}

export type ExcelActionItem = {
  contractor: string
  worker: string
  cert_name: string
  cert_category: string
  completed_on: string | null
  anniversary: string | null
  days_until_anniversary: number | null
  status: 'red' | 'yellow'
}

export type ExcelHeatmapCell = {
  status: ExcelStatus
  completed_on: string | null
  days_until_anniversary: number | null
}

export type ExcelHeatmapRow = {
  worker: string
  contractor: string
  job_title: string | null
  statuses: ExcelHeatmapCell[]
}

export type ExcelHeatmap = {
  cert_names: string[]
  cert_categories: string[]
  rows: ExcelHeatmapRow[]
}

export type ExcelCertDemand = {
  cert_name: string
  cert_category: string
  green: number
  yellow: number
  red: number
  blank: number
  coverage_pct: number
}

export type ExcelDashboard = {
  kpis: ExcelKPIs
  action_list: ExcelActionItem[]
  contractors: ExcelContractor[]
  heatmap: ExcelHeatmap
  cert_demand: ExcelCertDemand[]
  today: string
  issues: string[]
  workbook: {
    path: string
    last_modified: string
    loaded_at: string
  }
}

export type ExcelHealth = {
  workbook_path: string
  exists: boolean
  loaded: boolean
  last_modified?: string
  last_loaded?: string
  issues_count?: number
  today?: string
}
