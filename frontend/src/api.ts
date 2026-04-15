import type {
  CertificationAnalysis,
  Certification,
  Company,
  ContractorMatrixImportResult,
  ContractorMatrixPreview,
  Contractor,
  ReportPreview,
  DashboardOverview,
  SourceDocument,
  TrainingRecord,
  Worker,
  ContractorName,
} from './types'

const API_BASE = import.meta.env.VITE_API_BASE ?? ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init)
  if (!response.ok) {
    const contentType = response.headers.get('content-type') || ''
    const errorBody = contentType.includes('application/json')
      ? await response.json()
      : await response.text()
    const message =
      typeof errorBody === 'string'
        ? errorBody
        : errorBody.detail || errorBody.message || 'Request failed'
    throw new Error(message)
  }

  if (response.status === 204) {
    return undefined as T
  }
  return response.json() as Promise<T>
}

export const api = {
  getCompanies: () => request<Company[]>('/api/companies'),
  createCompany: (payload: Record<string, unknown>) =>
    request<Company>('/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  updateCompany: (companyId: number, payload: Record<string, unknown>) =>
    request<Company>(`/api/companies/${companyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  deleteCompany: (companyId: number) =>
    request<void>(`/api/companies/${companyId}`, { method: 'DELETE' }),

  getContractorRecords: (params: URLSearchParams) =>
    request<Contractor[]>(`/api/contractors?${params.toString()}`),
  createContractor: (payload: Record<string, unknown>) =>
    request<Contractor>('/api/contractors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  updateContractor: (contractorId: number, payload: Record<string, unknown>) =>
    request<Contractor>(`/api/contractors/${contractorId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  deleteContractor: (contractorId: number) =>
    request<void>(`/api/contractors/${contractorId}`, { method: 'DELETE' }),

  getWorkers: (params: URLSearchParams) =>
    request<Worker[]>(`/api/workers?${params.toString()}`),
  createWorker: (payload: Record<string, unknown>) =>
    request<Worker>('/api/workers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  updateWorker: (workerId: number, payload: Record<string, unknown>) =>
    request<Worker>(`/api/workers/${workerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  deleteWorker: (workerId: number) =>
    request<void>(`/api/workers/${workerId}`, { method: 'DELETE' }),

  getCertifications: (params: URLSearchParams) =>
    request<Certification[]>(`/api/certifications?${params.toString()}`),
  createCertification: (payload: FormData) =>
    request<Certification>('/api/certifications', {
      method: 'POST',
      body: payload,
    }),
  analyzeCertificationFile: (payload: FormData) =>
    request<CertificationAnalysis>('/api/certifications/analyze', {
      method: 'POST',
      body: payload,
    }),
  deleteCertification: (certificationId: number) =>
    request<void>(`/api/certifications/${certificationId}`, { method: 'DELETE' }),
  getContractors: () => request<ContractorName[]>('/api/lookups/contractors'),

  getDashboardOverview: (companyId: number | null) => {
    const params = new URLSearchParams()
    if (companyId) params.set('company_id', String(companyId))
    return request<DashboardOverview>(`/api/dashboard/overview?${params.toString()}`)
  },

  getReportPreview: (payload: Record<string, unknown>) =>
    request<ReportPreview>('/api/reports/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  getTrainingRecords: (params: URLSearchParams) =>
    request<TrainingRecord[]>(`/api/training/records?${params.toString()}`),
  getSourceDocuments: (params: URLSearchParams) =>
    request<SourceDocument[]>(`/api/training/documents?${params.toString()}`),
  previewTrainingImport: (payload: FormData) =>
    request<ContractorMatrixPreview>('/api/training/preview', {
      method: 'POST',
      body: payload,
    }),
  importTrainingDocument: (payload: FormData) =>
    request<ContractorMatrixImportResult>('/api/training/import', {
      method: 'POST',
      body: payload,
    }),

  buildExportUrl: (
    dataset: 'workers' | 'certifications',
    options: { companyId?: number | null; statusFilter?: string } = {},
  ) => {
    const params = new URLSearchParams()
    if (options.companyId) params.set('company_id', String(options.companyId))
    if (options.statusFilter) params.set('status_filter', options.statusFilter)
    const query = params.toString()
    return `${API_BASE}/api/exports/${dataset}.csv${query ? `?${query}` : ''}`
  },
}
