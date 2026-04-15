import { FormEvent, useEffect, useState } from 'react'

import { api } from '../api'
import type {
  ContractorMatrixImportResult,
  ContractorMatrixPreview,
  SourceDocument,
  TrainingRecord,
} from '../types'

type TrainingHubPageProps = {
  selectedCompanyId: number | null
}

export function TrainingHubPage({ selectedCompanyId }: TrainingHubPageProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ContractorMatrixPreview | null>(null)
  const [importResult, setImportResult] = useState<ContractorMatrixImportResult | null>(null)
  const [trainingRecords, setTrainingRecords] = useState<TrainingRecord[]>([])
  const [sourceDocuments, setSourceDocuments] = useState<SourceDocument[]>([])
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [importBusy, setImportBusy] = useState(false)
  const [loadingLibrary, setLoadingLibrary] = useState(true)

  async function loadLibrary() {
    const params = new URLSearchParams()
    if (selectedCompanyId) params.set('company_id', String(selectedCompanyId))
    try {
      setLoadingLibrary(true)
      const [records, documents] = await Promise.all([
        api.getTrainingRecords(params),
        api.getSourceDocuments(params),
      ])
      setTrainingRecords(records)
      setSourceDocuments(documents)
    } finally {
      setLoadingLibrary(false)
    }
  }

  useEffect(() => {
    loadLibrary().catch((error) =>
      setMessage(error instanceof Error ? error.message : 'Unable to load training library'),
    )
  }, [selectedCompanyId])

  async function handlePreview(event?: FormEvent) {
    event?.preventDefault()
    if (!file) {
      setMessage('Choose a contractor matrix PDF first.')
      return
    }

    try {
      setPreviewBusy(true)
      setMessage(null)
      setImportResult(null)
      const payload = new FormData()
      if (selectedCompanyId) payload.append('company_id', String(selectedCompanyId))
      payload.append('file', file)
      const result = await api.previewTrainingImport(payload)
      setPreview(result)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to analyze the document')
    } finally {
      setPreviewBusy(false)
    }
  }

  async function handleImport() {
    if (!file) {
      setMessage('Choose a contractor matrix PDF first.')
      return
    }

    try {
      setImportBusy(true)
      setMessage(null)
      const payload = new FormData()
      if (selectedCompanyId) payload.append('company_id', String(selectedCompanyId))
      payload.append('file', file)
      const result = await api.importTrainingDocument(payload)
      setImportResult(result)
      setMessage('Document imported successfully.')
      await loadLibrary()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to import the document')
    } finally {
      setImportBusy(false)
    }
  }

  const filteredTrainingRecords = !search.trim()
    ? trainingRecords
    : trainingRecords.filter((record) =>
        `${record.worker_name || ''} ${record.title} ${record.contractor_name || ''}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      )

  return (
    <section className="page-grid two-column">
      <article className="surface">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Contractor evidence intake</p>
            <h3>Review and import training matrix PDFs</h3>
          </div>
        </div>

        <form className="form-grid" onSubmit={handlePreview}>
          <label className="field field-full">
            <span>Source PDF</span>
            <input
              type="file"
              accept=".pdf"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null)
                setPreview(null)
                setImportResult(null)
              }}
            />
          </label>

          {message && <div className="info-banner field-full">{message}</div>}

          <div className="action-row field-full">
            <button className="ghost-button" type="submit" disabled={previewBusy}>
              {previewBusy ? 'Analyzing...' : 'Preview import'}
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={importBusy || !preview}
              onClick={handleImport}
            >
              {importBusy ? 'Importing...' : 'Import into app'}
            </button>
          </div>
        </form>

        {preview && (
          <div className="training-preview">
            <div className="stats-grid compact-stats">
              <div className="stat-card surface nested-surface">
                <p className="eyebrow">Contractor</p>
                <strong>{preview.contractor_name}</strong>
              </div>
              <div className="stat-card surface nested-surface">
                <p className="eyebrow">Employees</p>
                <strong>{preview.employee_matches.length}</strong>
              </div>
              <div className="stat-card surface nested-surface">
                <p className="eyebrow">Training records</p>
                <strong>{preview.training_records.length}</strong>
              </div>
              <div className="stat-card surface nested-surface">
                <p className="eyebrow">Certifications</p>
                <strong>{preview.certifications.length}</strong>
              </div>
            </div>

            <div className="list-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Preview summary</p>
                  <h3>{preview.file_name}</h3>
                </div>
                <div className="meta-block">
                  <span>{preview.original_contractor_name}</span>
                  <span>{preview.completed_on || 'No completion date detected'}</span>
                  <span>{preview.analysis_source}</span>
                </div>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Action</th>
                      <th>Training</th>
                      <th>Certifications</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.employee_matches.map((item) => (
                      <tr key={item.employee_name}>
                        <td>{item.employee_name}</td>
                        <td>
                          <span
                            className={`badge ${item.action === 'create' ? 'badge-expiring' : 'badge-valid'}`}
                          >
                            {item.action}
                          </span>
                        </td>
                        <td>{item.training_count}</td>
                        <td>{item.certification_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="preview-dual-grid">
                <div>
                  <p className="eyebrow">Training records that will be imported</p>
                  <div className="mini-list">
                    {preview.training_records.slice(0, 12).map((record, index) => (
                      <div key={`${record.employee_name}-${record.title}-${index}`} className="list-row">
                        <span>{record.employee_name} • {record.title}</span>
                        <strong>{record.issue_date}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="eyebrow">Certifications that will be imported</p>
                  <div className="mini-list">
                    {preview.certifications.slice(0, 12).map((record, index) => (
                      <div key={`${record.employee_name}-${record.title}-${index}`} className="list-row">
                        <span>{record.employee_name} • {record.title}</span>
                        <strong>{record.issue_date}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {importResult && (
          <div className="surface nested-surface import-result">
            <p className="eyebrow">Latest import</p>
            <h3>{importResult.source_document_name}</h3>
            <div className="company-metrics">
              <span>{importResult.created_workers} employees created</span>
              <span>{importResult.updated_workers} employees updated</span>
              <span>{importResult.created_training_records} training records created</span>
              <span>{importResult.updated_training_records} training records updated</span>
              <span>{importResult.created_certifications} certifications created</span>
              <span>{importResult.updated_certifications} certifications updated</span>
            </div>
          </div>
        )}
      </article>

      <article className="surface">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Evidence library</p>
            <h3>Source documents and imported training records</h3>
          </div>
        </div>

        <div className="toolbar">
          <label className="field">
            <span>Search records</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Employee, title, contractor"
            />
          </label>
        </div>

        <div className="library-grid">
          <div>
            <p className="eyebrow">Source documents</p>
            <div className="list-stack">
              {loadingLibrary && <div className="loading">Refreshing training library...</div>}
              {!loadingLibrary && sourceDocuments.length === 0 && (
                <div className="empty-copy">No source documents imported yet.</div>
              )}
              {sourceDocuments.map((document) => (
                <div key={document.id} className="cert-card">
                  <div>
                    <strong>{document.original_file_name || document.title}</strong>
                    <p>{document.contractor_name} • {document.completed_on || 'No completion date'}</p>
                  </div>
                  <div className="cert-actions">
                    {document.file_url && (
                      <a className="ghost-button" href={document.file_url} target="_blank" rel="noreferrer">
                        Open file
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="eyebrow">Training records</p>
            <div className="list-stack">
              {loadingLibrary && <div className="loading">Refreshing imported records...</div>}
              {!loadingLibrary && filteredTrainingRecords.length === 0 && (
                <div className="empty-copy">No training records match the current view.</div>
              )}
              {filteredTrainingRecords.map((record) => (
                <div key={record.id} className="cert-card">
                  <div>
                    <strong>{record.title}</strong>
                    <p>{record.worker_name} • {record.contractor_name || 'Unassigned'}</p>
                    <p>Issue date: {record.issue_date || 'Not set'}</p>
                  </div>
                  <div className="cert-actions">
                    {record.source_file_url && (
                      <a className="ghost-button" href={record.source_file_url} target="_blank" rel="noreferrer">
                        Source PDF
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </article>
    </section>
  )
}
