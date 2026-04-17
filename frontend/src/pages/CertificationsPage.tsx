import { useEffect, useState } from 'react'

import { api } from '../api'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { formatDate } from '../lib/compliance'
import type { SourceDocument, WorkerTraining } from '../types'

type CertificationsPageProps = {
  selectedCompanyId: number | null
}

export function CertificationsPage({ selectedCompanyId }: CertificationsPageProps) {
  const [records, setRecords] = useState<WorkerTraining[]>([])
  const [documents, setDocuments] = useState<SourceDocument[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const debouncedSearch = useDebouncedValue(search, 250)

  useEffect(() => {
    async function loadPageData() {
      const recordParams = new URLSearchParams()
      const documentParams = new URLSearchParams()
      if (selectedCompanyId) {
        recordParams.set('company_id', String(selectedCompanyId))
        documentParams.set('company_id', String(selectedCompanyId))
      }
      recordParams.set('status_filter', 'completed')
      if (debouncedSearch) recordParams.set('search', debouncedSearch)

      try {
        setLoading(true)
        const [recordData, documentData] = await Promise.all([
          api.getTrainingRecords(recordParams),
          api.getSourceDocuments(documentParams),
        ])
        setRecords(recordData)
        setDocuments(documentData)
      } finally {
        setLoading(false)
      }
    }

    loadPageData().catch((error) =>
      setMessage(error instanceof Error ? error.message : 'Unable to load evidence library'),
    )
  }, [selectedCompanyId, debouncedSearch])

  return (
    <section className="page-grid">
      <article className="surface panel-stack">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Evidence library</p>
            <h3>Completed training records and source files</h3>
          </div>
          <a
            className="ghost-button"
            href={api.buildExportUrl('trainings', { companyId: selectedCompanyId, statusFilter: 'completed' })}
          >
            Export CSV
          </a>
        </div>

        <div className="toolbar">
          <label className="field">
            <span>Search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Worker, contractor, training"
            />
          </label>
        </div>

        {message && <div className="info-banner">{message}</div>}
        {loading && <div className="loading">Loading evidence library...</div>}

        <div className="page-grid two-column">
          <div className="surface nested-surface">
            <p className="eyebrow">Source documents</p>
            <h3>Imported PDFs</h3>
            <div className="list-stack">
              {documents.length === 0 && <div className="empty-copy">No documents available yet.</div>}
              {documents.map((document) => (
                <div key={document.id} className="list-row">
                  <div>
                    <strong>{document.original_file_name || document.title}</strong>
                    <p>
                      {document.contractor_name} • {document.training_count} linked records •{' '}
                      {formatDate(document.completed_on)}
                    </p>
                  </div>
                  {document.file_url && (
                    <a className="ghost-button" href={document.file_url} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="surface nested-surface">
            <p className="eyebrow">Completed records</p>
            <h3>Training dates on file</h3>
            <div className="list-stack">
              {records.length === 0 && <div className="empty-copy">No completed training records found.</div>}
              {records.map((record) => (
                <div key={`${record.worker_id}-${record.catalog_id}`} className="list-row">
                  <div>
                    <strong>{record.catalog_name}</strong>
                    <p>
                      {record.worker_name} • {record.contractor_name || 'Unassigned'} •{' '}
                      {formatDate(record.completed_on)}
                    </p>
                  </div>
                  {record.evidence_url && (
                    <a className="ghost-button" href={record.evidence_url} target="_blank" rel="noreferrer">
                      Open file
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </article>
    </section>
  )
}
