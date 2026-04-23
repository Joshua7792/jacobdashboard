import { FormEvent, useEffect, useMemo, useState } from 'react'

import { api } from '../api'
import {
  formatDate,
  getTrainingState,
  summarizeWorkerCompliance,
  trainingsByCategory,
  workerCompletionPercentage,
} from '../lib/compliance'
import type {
  ContractorMatrixImportResult,
  ContractorMatrixPreview,
  SourceDocument,
  Worker,
  WorkerTraining,
} from '../types'

type TrainingHubPageProps = {
  selectedCompanyId: number | null
}

type DraftDates = Record<number, string>

export function TrainingHubPage({ selectedCompanyId }: TrainingHubPageProps) {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [sourceDocuments, setSourceDocuments] = useState<SourceDocument[]>([])
  const [selectedWorkerId, setSelectedWorkerId] = useState<number | null>(null)
  const [workerSearch, setWorkerSearch] = useState('')
  const [contractorFilter, setContractorFilter] = useState('')
  const [draftDates, setDraftDates] = useState<DraftDates>({})
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ContractorMatrixPreview | null>(null)
  const [importResult, setImportResult] = useState<ContractorMatrixImportResult | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [importBusy, setImportBusy] = useState(false)
  const [savingCatalogId, setSavingCatalogId] = useState<number | null>(null)
  const [clearingCatalogId, setClearingCatalogId] = useState<number | null>(null)
  const [loadingWorkspace, setLoadingWorkspace] = useState(true)

  async function loadWorkspace() {
    const params = new URLSearchParams()
    if (selectedCompanyId) params.set('company_id', String(selectedCompanyId))

    try {
      setLoadingWorkspace(true)
      const [workerData, documentData] = await Promise.all([
        api.getWorkers(params),
        api.getSourceDocuments(params),
      ])
      setWorkers(workerData)
      setSourceDocuments(documentData)
      setSelectedWorkerId((current) =>
        current && workerData.some((worker) => worker.id === current) ? current : workerData[0]?.id ?? null,
      )
    } finally {
      setLoadingWorkspace(false)
    }
  }

  useEffect(() => {
    loadWorkspace().catch((error) =>
      setMessage(error instanceof Error ? error.message : 'Unable to load training hub'),
    )
  }, [selectedCompanyId])

  const currentCompanyName = workers[0]?.company_name || 'Cordillera'
  const contractorOptions = Array.from(
    new Set(
      workers
        .map((worker) => worker.contractor_name)
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort()

  const filteredWorkers = workers.filter((worker) => {
    if (contractorFilter && worker.contractor_name !== contractorFilter) return false
    if (!workerSearch.trim()) return true
    const query = workerSearch.toLowerCase()
    return `${worker.full_name} ${worker.job_title || ''} ${worker.contractor_name || ''}`
      .toLowerCase()
      .includes(query)
  })

  useEffect(() => {
    if (!filteredWorkers.length) {
      setSelectedWorkerId(null)
      return
    }
    if (!selectedWorkerId || !filteredWorkers.some((worker) => worker.id === selectedWorkerId)) {
      setSelectedWorkerId(filteredWorkers[0].id)
    }
  }, [selectedWorkerId, filteredWorkers])

  const groupedWorkers = contractorOptions
    .map((contractorName) => ({
      contractorName,
      workers: filteredWorkers.filter((worker) => worker.contractor_name === contractorName),
    }))
    .filter((group) => group.workers.length > 0)

  const selectedWorker =
    workers.find((worker) => worker.id === selectedWorkerId) ??
    filteredWorkers.find((worker) => worker.id === selectedWorkerId) ??
    null

  useEffect(() => {
    if (!selectedWorker) {
      setDraftDates({})
      return
    }
    setDraftDates(
      Object.fromEntries(
        selectedWorker.trainings.map((training) => [training.catalog_id, training.completed_on ?? '']),
      ),
    )
  }, [selectedWorkerId, selectedWorker?.updated_at, selectedWorker?.trainings_completed])

  const selectedSummary = selectedWorker ? summarizeWorkerCompliance(selectedWorker.trainings) : null
  const readinessPercentage = selectedWorker ? workerCompletionPercentage(selectedWorker) : 0
  const primaryRows = selectedWorker ? trainingsByCategory(selectedWorker.trainings, 'primary') : []
  const otherRows = selectedWorker ? trainingsByCategory(selectedWorker.trainings, 'otros') : []
  const selectedWorkerDocuments = sourceDocuments.filter(
    (document) =>
      document.contractor_name === selectedWorker?.contractor_name ||
      document.company_name === selectedWorker?.company_name,
  )

  const scopeSummary = useMemo(
    () =>
      filteredWorkers.reduce(
        (totals, worker) => {
          totals.workerCount += 1
          totals.activeItems += worker.trainings_completed
          totals.inactiveItems += worker.trainings_required - worker.trainings_completed
          return totals
        },
        { workerCount: 0, contractorCount: contractorFilter ? 1 : groupedWorkers.length, activeItems: 0, inactiveItems: 0 },
      ),
    [filteredWorkers, contractorFilter, groupedWorkers.length],
  )

  const scopeCoverage =
    scopeSummary.activeItems + scopeSummary.inactiveItems > 0
      ? Math.round((scopeSummary.activeItems / (scopeSummary.activeItems + scopeSummary.inactiveItems)) * 100)
      : 0

  async function saveTraining(training: WorkerTraining) {
    if (!selectedWorker) return
    const draftValue = draftDates[training.catalog_id] ?? ''
    if (!draftValue) {
      setMessage('Choose a date before saving, or use Clear to remove a record.')
      return
    }

    try {
      setSavingCatalogId(training.catalog_id)
      setMessage(null)
      const payload = new FormData()
      payload.append('worker_id', String(selectedWorker.id))
      payload.append('catalog_id', String(training.catalog_id))
      payload.append('completed_on', draftValue)
      await api.upsertTrainingRecord(payload)
      setMessage(`Saved ${training.catalog_name}.`)
      await loadWorkspace()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save training record')
    } finally {
      setSavingCatalogId(null)
    }
  }

  async function clearTraining(training: WorkerTraining) {
    if (!selectedWorker) return
    try {
      setClearingCatalogId(training.catalog_id)
      setMessage(null)
      if (training.id) {
        await api.deleteTrainingRecord(selectedWorker.id, training.catalog_id)
      } else {
        setDraftDates((current) => ({ ...current, [training.catalog_id]: '' }))
      }
      setMessage(`Cleared ${training.catalog_name}.`)
      await loadWorkspace()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to clear training record')
    } finally {
      setClearingCatalogId(null)
    }
  }

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
      await loadWorkspace()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to import the document')
    } finally {
      setImportBusy(false)
    }
  }

  function renderTrainingGroup(title: string, rows: WorkerTraining[]) {
    return (
      <div className="surface nested-surface">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Required items</p>
            <h3>{title}</h3>
          </div>
          <span>{rows.length} items</span>
        </div>

        <div className="matrix-list">
          {rows.map((training) => {
            const state = getTrainingState(training.completed_on)
            const busy = savingCatalogId === training.catalog_id || clearingCatalogId === training.catalog_id
            return (
              <div key={training.catalog_id} className="matrix-row">
                <div className="matrix-copy">
                  <strong>{training.catalog_name}</strong>
                  <p>{state.helper}</p>
                  {training.source_document_name && <p>Source: {training.source_document_name}</p>}
                  {training.evidence_file_name && <p>Evidence: {training.evidence_file_name}</p>}
                </div>
                <div className="matrix-edit">
                  <span className={`badge ${state.className}`}>{state.label}</span>
                  <input
                    className="matrix-date-input"
                    type="date"
                    value={draftDates[training.catalog_id] ?? ''}
                    onChange={(event) =>
                      setDraftDates((current) => ({
                        ...current,
                        [training.catalog_id]: event.target.value,
                      }))
                    }
                  />
                  <div className="matrix-actions">
                    <button
                      className="primary-button"
                      disabled={busy}
                      type="button"
                      onClick={() => saveTraining(training)}
                    >
                      {savingCatalogId === training.catalog_id ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      className="ghost-button"
                      disabled={busy}
                      type="button"
                      onClick={() => clearTraining(training)}
                    >
                      {clearingCatalogId === training.catalog_id ? 'Clearing...' : 'Clear'}
                    </button>
                  </div>
                  {training.evidence_url && (
                    <a className="ghost-button" href={training.evidence_url} target="_blank" rel="noreferrer">
                      Open file
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <section className="page-grid">
      <article className="surface audit-hero">
        <div>
          <p className="eyebrow">Training hub</p>
          <h3>{currentCompanyName} field-readiness board</h3>
          <p className="hero-copy">
            Select a contractor, choose a worker, and update the exact training dates you need for
            audits. Green means active with a date on file. Gray means inactive because no date has
            been recorded yet.
          </p>
        </div>

        <div className="audit-stat-grid">
          <div className="audit-stat-tile">
            <span>Workers in scope</span>
            <strong>{scopeSummary.workerCount}</strong>
          </div>
          <div className="audit-stat-tile">
            <span>Contractors</span>
            <strong>{scopeSummary.contractorCount}</strong>
          </div>
          <div className="audit-stat-tile">
            <span>Coverage</span>
            <strong>{scopeCoverage}%</strong>
          </div>
          <div className="audit-stat-tile">
            <span>Inactive items</span>
            <strong>{scopeSummary.inactiveItems}</strong>
          </div>
        </div>
      </article>

      <div className="contractor-rail">
        <button
          className={contractorFilter ? 'scope-chip' : 'scope-chip active'}
          onClick={() => setContractorFilter('')}
          type="button"
        >
          <strong>All contractors</strong>
          <span>{workers.length} workers</span>
        </button>
        {groupedWorkers.map((group) => (
          <button
            key={group.contractorName}
            className={contractorFilter === group.contractorName ? 'scope-chip active' : 'scope-chip'}
            onClick={() => setContractorFilter(group.contractorName)}
            type="button"
          >
            <strong>{group.contractorName}</strong>
            <span>{group.workers.length} workers</span>
          </button>
        ))}
      </div>

      <div className="page-grid two-column training-hub-grid">
        <article className="surface panel-stack">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Contractor roster</p>
              <h3>Choose a worker</h3>
            </div>
            <div className="badge badge-valid">Cordillera scope</div>
          </div>

          <div className="toolbar">
            <label className="field">
              <span>Contractor</span>
              <select value={contractorFilter} onChange={(event) => setContractorFilter(event.target.value)}>
                <option value="">All contractors</option>
                {contractorOptions.map((contractor) => (
                  <option key={contractor} value={contractor}>
                    {contractor}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Search worker</span>
              <input
                value={workerSearch}
                onChange={(event) => setWorkerSearch(event.target.value)}
                placeholder="Name, role, contractor"
              />
            </label>
          </div>

          {loadingWorkspace && <div className="loading">Loading workforce...</div>}
          {!loadingWorkspace && filteredWorkers.length === 0 && (
            <div className="empty-copy">No workers match the current filters.</div>
          )}

          <div className="contractor-group-stack">
            {groupedWorkers.map((group) => (
              <section key={group.contractorName} className="contractor-group">
                <div className="contractor-group-heading">
                  <div>
                    <p className="eyebrow">Contractor</p>
                    <h4>{group.contractorName}</h4>
                  </div>
                  <span>{group.workers.length} workers</span>
                </div>

                <div className="company-card-grid worker-list-grid">
                  {group.workers.map((worker) => {
                    const summary = summarizeWorkerCompliance(worker.trainings)
                    const completion = workerCompletionPercentage(worker)

                    return (
                      <button
                        key={worker.id}
                        className={worker.id === selectedWorkerId ? 'company-card active audit-worker-card' : 'company-card audit-worker-card'}
                        onClick={() => setSelectedWorkerId(worker.id)}
                      >
                        <div className="worker-card-header">
                          <div>
                            <strong>{worker.full_name}</strong>
                            <p>{worker.job_title || 'No role assigned'}</p>
                          </div>
                          <span className="badge badge-valid">{completion}% ready</span>
                        </div>

                        <div className="worker-healthline">
                          <span>{summary.activeItems} active</span>
                          <span>{summary.inactiveItems} inactive</span>
                        </div>

                        <div className="progress-track" aria-hidden="true">
                          <div className="progress-fill" style={{ width: `${completion}%` }} />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        </article>

        <article className="surface panel-stack">
          {selectedWorker && selectedSummary ? (
            <>
              <div className="worker-profile-head">
                <div>
                  <p className="eyebrow">Worker compliance profile</p>
                  <h3>{selectedWorker.full_name}</h3>
                  <p className="muted-copy">
                    {selectedWorker.contractor_name || 'Unassigned'} • {selectedWorker.job_title || 'No role set'}
                  </p>
                </div>
                <div className="worker-profile-score">
                  <span>Readiness</span>
                  <strong>{readinessPercentage}%</strong>
                </div>
              </div>

              <div className="stats-grid compact-stats worker-summary-grid">
                <div className="stat-card surface nested-surface">
                  <p className="eyebrow">Required items</p>
                  <strong>{selectedSummary.totalItems}</strong>
                </div>
                <div className="stat-card surface nested-surface">
                  <p className="eyebrow">Active</p>
                  <strong>{selectedSummary.activeItems}</strong>
                </div>
                <div className="stat-card surface nested-surface">
                  <p className="eyebrow">Inactive</p>
                  <strong>{selectedSummary.inactiveItems}</strong>
                </div>
                <div className="stat-card surface nested-surface">
                  <p className="eyebrow">Worker status</p>
                  <strong>{selectedWorker.onboarding_status}</strong>
                </div>
              </div>

              {message && <div className="info-banner">{message}</div>}

              <div className="preview-dual-grid compliance-board">
                {renderTrainingGroup('Adiestramientos', primaryRows)}
                {renderTrainingGroup('Otros adiestramientos', otherRows)}
              </div>

              <div className="surface nested-surface linked-documents-panel">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Contractor evidence</p>
                    <h3>Linked source documents</h3>
                  </div>
                </div>

                <div className="list-stack">
                  {selectedWorkerDocuments.length === 0 && (
                    <div className="empty-copy">No contractor source documents are linked yet.</div>
                  )}
                  {selectedWorkerDocuments.map((document) => (
                    <div key={document.id} className="cert-card">
                      <div>
                        <strong>{document.original_file_name || document.title}</strong>
                        <p>
                          {document.contractor_name} • Completed on {formatDate(document.completed_on)}
                        </p>
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
            </>
          ) : (
            <div className="empty-copy">Choose a worker from the left to review and update training dates.</div>
          )}
        </article>
      </div>

      <article className="surface panel-stack">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PDF import</p>
            <h3>Bring in a contractor training matrix when you receive one</h3>
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

        {(preview || importResult) && (
          <div className="preview-dual-grid optional-import-grid">
            {preview && (
              <div className="surface nested-surface">
                <p className="eyebrow">Preview summary</p>
                <h3>{preview.file_name}</h3>
                <div className="company-metrics">
                  <span>{preview.contractor_name}</span>
                  <span>{preview.employee_matches.length} workers</span>
                  <span>{preview.trainings.length} training rows</span>
                  <span>{preview.language.toUpperCase()} parser</span>
                </div>
                {preview.unknown_columns.length > 0 && (
                  <p className="muted-copy">
                    Unmapped columns: {preview.unknown_columns.join(', ')}
                  </p>
                )}
              </div>
            )}

            {importResult && (
              <div className="surface nested-surface import-result">
                <p className="eyebrow">Latest import</p>
                <h3>{importResult.source_document_name}</h3>
                <div className="company-metrics">
                  <span>{importResult.created_workers} workers created</span>
                  <span>{importResult.updated_workers} workers updated</span>
                  <span>{importResult.created_trainings} trainings created</span>
                  <span>{importResult.updated_trainings} trainings updated</span>
                </div>
              </div>
            )}
          </div>
        )}
      </article>
    </section>
  )
}
