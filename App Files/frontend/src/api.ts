// Thin fetch wrapper for the backend's /api/excel/* endpoints.
//
// VITE_API_BASE lets the dev server target a different host (e.g. when running
// the frontend on its own port and proxying to a separately-running backend).
// In the packaged desktop build the frontend is served from the same origin
// as the API, so VITE_API_BASE stays empty and requests are same-origin.
import type { ExcelDashboard, ExcelHealth, ExcelWorker } from './types'

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
  getExcelHealth: () => request<ExcelHealth>('/api/excel/health'),
  getExcelDashboard: () => request<ExcelDashboard>('/api/excel/dashboard'),
  getExcelWorker: (name: string) =>
    request<ExcelWorker>(`/api/excel/workers/${encodeURIComponent(name)}`),
  refreshExcelWorkbook: () =>
    request<{ ok: boolean; loaded_at: string; last_modified: string }>(
      '/api/excel/refresh',
      { method: 'POST' },
    ),
}
