import { FormEvent, useEffect, useState } from 'react'

import { api } from '../api'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import type { Certification, CertificationAnalysis, Worker } from '../types'

type CertificationsPageProps = {
  selectedCompanyId: number | null
}

export function CertificationsPage({ selectedCompanyId }: CertificationsPageProps) {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [certifications, setCertifications] = useState<Certification[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [analysisBusy, setAnalysisBusy] = useState(false)
  const [analysis, setAnalysis] = useState<CertificationAnalysis | null>(null)
  const [form, setForm] = useState({
    worker_id: 0,
    title: '',
    contractor: '',
    issue_date: '',
    expiration_date: '',
    notes: '',
  })
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedCertification, setSelectedCertification] = useState<Certification | null>(null)
  const debouncedSearch = useDebouncedValue(search, 250)
  const selectedWorker = workers.find((worker) => worker.id === form.worker_id) ?? null
  const selectedWorkerContractor =
    selectedWorker?.contractor_name || selectedWorker?.company_name || 'Unassigned'

  async function loadPageData() {
    const workerParams = new URLSearchParams()
    const certParams = new URLSearchParams()
    if (selectedCompanyId) {
      workerParams.set('company_id', String(selectedCompanyId))
      certParams.set('company_id', String(selectedCompanyId))
    }
    if (debouncedSearch) certParams.set('search', debouncedSearch)
    if (statusFilter) certParams.set('status_filter', statusFilter)
    try {
      setLoading(true)

      const [workerData, certificationData] = await Promise.all([
        api.getWorkers(workerParams),
        api.getCertifications(certParams),
      ])

      setWorkers(workerData)
      setCertifications(certificationData)
      setSelectedCertification((current) => {
        if (!certificationData.length) return null
        if (current && certificationData.some((item) => item.id === current.id)) {
          return certificationData.find((item) => item.id === current.id) ?? certificationData[0]
        }
        return certificationData[0]
      })
      setForm((current) => ({
        ...current,
        worker_id: current.worker_id || workerData[0]?.id || 0,
      }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPageData().catch((error) =>
      setMessage(error instanceof Error ? error.message : 'Unable to load certifications'),
    )
  }, [selectedCompanyId, debouncedSearch, statusFilter])

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      setAnalysis(null)
      return
    }

    const nextPreviewUrl = URL.createObjectURL(file)
    setPreviewUrl(nextPreviewUrl)

    return () => {
      URL.revokeObjectURL(nextPreviewUrl)
    }
  }, [file])

  async function analyzeSelectedFile(nextFile: File) {
    try {
      setAnalysisBusy(true)
      setMessage(null)
      const payload = new FormData()
      payload.append('file', nextFile)
      const result = await api.analyzeCertificationFile(payload)
      setAnalysis(result)
      setForm((current) => ({
        ...current,
        title: current.title || result.detected_title || '',
        contractor: current.contractor || selectedWorker?.contractor_name || result.detected_contractor || '',
        issue_date: current.issue_date || result.detected_issue_date || '',
        expiration_date: current.expiration_date || result.detected_expiration_date || '',
        notes:
          current.notes ||
          (result.text_preview
            ? `Document preview: ${result.text_preview.slice(0, 200)}`
            : ''),
      }))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to analyze file')
    } finally {
      setAnalysisBusy(false)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!form.worker_id) {
      setMessage('Select a worker before uploading a certification.')
      return
    }

    try {
      setBusy(true)
      setMessage(null)
      const payload = new FormData()
      payload.append('worker_id', String(form.worker_id))
      payload.append('title', form.title)
      payload.append('contractor', selectedWorker?.contractor_name || form.contractor)
      payload.append('issue_date', form.issue_date)
      if (form.expiration_date) payload.append('expiration_date', form.expiration_date)
      payload.append('notes', form.notes)
      if (file) payload.append('file', file)

      await api.createCertification(payload)
      setForm({
        worker_id: form.worker_id,
        title: '',
        contractor: '',
        issue_date: '',
        expiration_date: '',
        notes: '',
      })
      setFile(null)
      setAnalysis(null)
      setPreviewUrl(null)
      setMessage('Certification saved.')
      await loadPageData()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save certification')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(certificationId: number) {
    const confirmed = window.confirm('Delete this certification record?')
    if (!confirmed) return
    try {
      await api.deleteCertification(certificationId)
      setMessage('Certification deleted.')
      await loadPageData()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to delete certification')
    }
  }

  return (
    <section className="page-grid two-column">
      <article className="surface">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Upload center</p>
            <h3>Certification records</h3>
          </div>
        </div>

        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="field">
            <span>Employee</span>
            <select
              required
              value={form.worker_id}
              onChange={(event) =>
                setForm((current) => {
                  const workerId = Number(event.target.value)
                  const nextWorker = workers.find((worker) => worker.id === workerId)
                  return {
                    ...current,
                    worker_id: workerId,
                    contractor: nextWorker?.contractor_name || '',
                  }
                })
              }
            >
              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.full_name} • {worker.contractor_name || worker.company_name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Certification title</span>
            <input
              required
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="OSHA 30"
            />
          </label>

          <label className="field">
            <span>Contractor</span>
            <input value={selectedWorkerContractor} readOnly />
          </label>

          <label className="field">
            <span>Issue date</span>
            <input
              required
              type="date"
              value={form.issue_date}
              onChange={(event) =>
                setForm((current) => ({ ...current, issue_date: event.target.value }))
              }
            />
          </label>

          <label className="field">
            <span>Expiration date</span>
            <input
              type="date"
              value={form.expiration_date}
              onChange={(event) =>
                setForm((current) => ({ ...current, expiration_date: event.target.value }))
              }
            />
          </label>

          <label className="field">
            <span>File</span>
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={(event) => {
                const nextFile = event.target.files?.[0] ?? null
                setFile(nextFile)
                if (nextFile) {
                  analyzeSelectedFile(nextFile)
                } else {
                  setAnalysis(null)
                }
              }}
            />
          </label>

          <div className="field field-full">
            <span>Smart extraction</span>
            <div className="analysis-card">
              {analysisBusy && <p className="muted-copy">Reading the file and suggesting fields...</p>}
              {!analysisBusy && !analysis && (
                <p className="muted-copy">
                  Upload a PDF or image and the app will try to detect the certification title,
                  dates, and document details for you.
                </p>
              )}
              {analysis && (
                <div className="analysis-grid">
                  <div className="analysis-item">
                    <span>Source</span>
                    <strong>{analysis.analysis_source}</strong>
                  </div>
                  <div className="analysis-item">
                    <span>Detected title</span>
                    <strong>{analysis.detected_title || 'Not found'}</strong>
                  </div>
                  <div className="analysis-item">
                    <span>Detected contractor</span>
                    <strong>{analysis.detected_contractor || 'Not found'}</strong>
                  </div>
                  <div className="analysis-item">
                    <span>Issue date</span>
                    <strong>{analysis.detected_issue_date || 'Not found'}</strong>
                  </div>
                  <div className="analysis-item">
                    <span>Expiration date</span>
                    <strong>{analysis.detected_expiration_date || 'Not found'}</strong>
                  </div>
                  {analysis.text_preview && (
                    <div className="analysis-preview">
                      <span>Document preview</span>
                      <p>{analysis.text_preview}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <label className="field field-full">
            <span>Notes</span>
            <textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>

          {message && <div className="info-banner field-full">{message}</div>}

          <div className="action-row field-full">
            <button className="primary-button" disabled={busy} type="submit">
              {busy ? 'Uploading...' : 'Save certification'}
            </button>
          </div>
        </form>
      </article>

      <article className="surface">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Library</p>
            <h3>Attached certifications</h3>
          </div>
          <div className="section-actions">
            <a
              className="ghost-button"
              href={api.buildExportUrl('certifications', {
                companyId: selectedCompanyId,
                statusFilter,
              })}
            >
              Export certs CSV
            </a>
            <a
              className="ghost-button"
              href={api.buildExportUrl('workers', { companyId: selectedCompanyId })}
            >
              Export employees CSV
            </a>
          </div>
        </div>

        <div className="toolbar">
          <label className="field">
            <span>Search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Title, employee, contractor, file"
            />
          </label>
          <label className="field">
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All</option>
              <option value="valid">Valid</option>
              <option value="expiring">Expiring</option>
              <option value="expired">Expired</option>
              <option value="no-expiration">No expiration</option>
            </select>
          </label>
        </div>

        <div className="list-stack">
          {loading && <div className="loading">Loading certifications...</div>}
          {!loading && certifications.length === 0 && (
            <div className="empty-copy">No certifications match the current filters.</div>
          )}
          {certifications.map((certification) => (
            <div
              key={certification.id}
              className={
                selectedCertification?.id === certification.id ? 'cert-card active' : 'cert-card'
              }
              onClick={() => setSelectedCertification(certification)}
            >
              <div>
                <div className="cert-headline">
                  <strong>{certification.title}</strong>
                  <span className={`badge badge-${certification.status}`}>{certification.status}</span>
                </div>
                <p>
                  {certification.worker_name} • {certification.company_name}
                </p>
                <p>
                  Contractor: {certification.contractor || 'Not set'} • Expires:{' '}
                  {certification.expiration_date || 'No expiration'}
                </p>
              </div>

              <div className="cert-actions">
                {certification.file_url ? (
                  <a className="ghost-button" href={certification.file_url} target="_blank" rel="noreferrer">
                    Open file
                  </a>
                ) : (
                  <span className="muted-copy">No uploaded file</span>
                )}
                <button
                  className="danger-button"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    handleDelete(certification.id)
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="preview-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Preview</p>
              <h3>{file ? 'Current upload' : selectedCertification?.title || 'No file selected'}</h3>
            </div>
          </div>

          {previewUrl && file?.type.startsWith('image/') && (
            <img className="file-preview-image" src={previewUrl} alt="Selected upload preview" />
          )}
          {previewUrl && file?.type === 'application/pdf' && (
            <iframe className="file-preview-frame" src={previewUrl} title="Selected upload preview" />
          )}
          {!previewUrl && selectedCertification?.file_url && (
            selectedCertification.file_type?.startsWith('image/') ? (
              <img
                className="file-preview-image"
                src={selectedCertification.file_url}
                alt={selectedCertification.title}
              />
            ) : (
              <iframe
                className="file-preview-frame"
                src={selectedCertification.file_url}
                title={selectedCertification.title}
              />
            )
          )}
          {!previewUrl && !selectedCertification?.file_url && (
            <p className="muted-copy">
              Pick a certification row or upload a file to preview the document here.
            </p>
          )}
        </div>
      </article>
    </section>
  )
}
