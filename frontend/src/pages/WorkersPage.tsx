import { FormEvent, useEffect, useState } from 'react'

import { api } from '../api'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { summarizeWorkerCompliance, workerCompletionPercentage } from '../lib/compliance'
import type { Company, Contractor, Worker } from '../types'

type WorkersPageProps = {
  companies: Company[]
  selectedCompanyId: number | null
}

type WorkerFormState = {
  company_id: number
  contractor_id: number | null
  full_name: string
  employee_code: string
  job_title: string
  onboarding_status: string
  hire_date: string
  email: string
  phone: string
  notes: string
}

const workerTemplate: WorkerFormState = {
  company_id: 0,
  contractor_id: null,
  full_name: '',
  employee_code: '',
  job_title: '',
  onboarding_status: 'active',
  hire_date: '',
  email: '',
  phone: '',
  notes: '',
}

function complianceBadgeClass(status: string) {
  if (status === 'complete') return 'badge-valid'
  if (status === 'partial') return 'badge-expiring'
  return 'badge-missing'
}

export function WorkersPage({ companies, selectedCompanyId }: WorkersPageProps) {
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [search, setSearch] = useState('')
  const [contractorFilter, setContractorFilter] = useState('')
  const [complianceFilter, setComplianceFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedWorkerId, setSelectedWorkerId] = useState<number | null>(null)
  const [form, setForm] = useState<WorkerFormState>({
    ...workerTemplate,
    company_id: selectedCompanyId ?? companies[0]?.id ?? 0,
    contractor_id: null,
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const debouncedSearch = useDebouncedValue(search, 250)

  async function loadContractors() {
    const params = new URLSearchParams()
    if (selectedCompanyId) params.set('company_id', String(selectedCompanyId))
    const data = await api.getContractorRecords(params)
    setContractors(data)
  }

  async function loadWorkers() {
    const params = new URLSearchParams()
    if (selectedCompanyId) params.set('company_id', String(selectedCompanyId))
    if (contractorFilter) params.set('contractor_id', contractorFilter)
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (complianceFilter) params.set('compliance_status', complianceFilter)
    try {
      setLoading(true)
      const data = await api.getWorkers(params)
      setWorkers(data)
      setSelectedWorkerId((current) => (current && data.some((worker) => worker.id === current) ? current : data[0]?.id ?? null))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadContractors().catch((error) =>
      setMessage(error instanceof Error ? error.message : 'Unable to load contractors'),
    )
  }, [selectedCompanyId])

  useEffect(() => {
    loadWorkers().catch((error) =>
      setMessage(error instanceof Error ? error.message : 'Unable to load workforce'),
    )
  }, [selectedCompanyId, contractorFilter, debouncedSearch, complianceFilter])

  useEffect(() => {
    setForm((current) => ({
      ...current,
      company_id: current.company_id || selectedCompanyId || companies[0]?.id || 0,
    }))
  }, [selectedCompanyId, companies])

  const selectedWorker = workers.find((worker) => worker.id === selectedWorkerId) ?? null

  function resetForm() {
    setSelectedWorkerId(null)
    setForm({
      ...workerTemplate,
      company_id: selectedCompanyId ?? companies[0]?.id ?? 0,
      contractor_id: null,
    })
  }

  function fillForm(worker: Worker) {
    setSelectedWorkerId(worker.id)
    setForm({
      company_id: worker.company_id,
      contractor_id: worker.contractor_id,
      full_name: worker.full_name,
      employee_code: worker.employee_code ?? '',
      job_title: worker.job_title ?? '',
      onboarding_status: worker.onboarding_status,
      hire_date: worker.hire_date ?? '',
      email: worker.email ?? '',
      phone: worker.phone ?? '',
      notes: worker.notes ?? '',
    })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    try {
      setBusy(true)
      setMessage(null)
      const payload = {
        ...form,
        contractor_id: form.contractor_id || null,
        employee_code: form.employee_code || null,
        job_title: form.job_title || null,
        hire_date: form.hire_date || null,
        email: form.email || null,
        phone: form.phone || null,
        notes: form.notes || null,
      }

      if (selectedWorkerId) {
        await api.updateWorker(selectedWorkerId, payload)
        setMessage('Worker updated.')
      } else {
        await api.createWorker(payload)
        setMessage('Worker added.')
        resetForm()
      }

      await loadWorkers()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save worker')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!selectedWorkerId) return
    const confirmed = window.confirm('Delete this worker and all linked training records?')
    if (!confirmed) return

    try {
      setBusy(true)
      setMessage(null)
      await api.deleteWorker(selectedWorkerId)
      resetForm()
      setMessage('Worker deleted.')
      await loadWorkers()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to delete worker')
    } finally {
      setBusy(false)
    }
  }

  const selectedSummary = selectedWorker ? summarizeWorkerCompliance(selectedWorker.trainings) : null
  const completionPercentage = selectedWorker ? workerCompletionPercentage(selectedWorker) : 0

  return (
    <section className="page-grid two-column">
      <article className="surface panel-stack">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Project workforce</p>
            <h3>Workers</h3>
          </div>
        </div>

        <div className="toolbar">
          <label className="field">
            <span>Contractor</span>
            <select value={contractorFilter} onChange={(event) => setContractorFilter(event.target.value)}>
              <option value="">All contractors</option>
              {contractors.map((contractor) => (
                <option key={contractor.id} value={contractor.id}>
                  {contractor.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, code, role, email"
            />
          </label>
          <label className="field">
            <span>Compliance</span>
            <select value={complianceFilter} onChange={(event) => setComplianceFilter(event.target.value)}>
              <option value="">All</option>
              <option value="complete">Complete</option>
              <option value="partial">Partial</option>
              <option value="missing">Missing</option>
            </select>
          </label>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Worker</th>
                <th>Contractor</th>
                <th>Compliance</th>
                <th>Ready</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4}>
                    <div className="loading">Loading workers...</div>
                  </td>
                </tr>
              )}
              {!loading && workers.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    <div className="empty-copy">No workers match the current filters.</div>
                  </td>
                </tr>
              )}
              {workers.map((worker) => (
                <tr key={worker.id} onClick={() => fillForm(worker)}>
                  <td>
                    <strong>{worker.full_name}</strong>
                    <p>{worker.job_title || 'No role'}</p>
                  </td>
                  <td>{worker.contractor_name || 'Unassigned'}</td>
                  <td>
                    <span className={`badge ${complianceBadgeClass(worker.compliance_status)}`}>
                      {worker.compliance_status}
                    </span>
                  </td>
                  <td>{worker.compliance_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedWorker && selectedSummary && (
          <div className="preview-panel">
            <p className="eyebrow">Selected worker</p>
            <h3>{selectedWorker.full_name}</h3>
            <div className="company-metrics">
              <span>{selectedSummary.activeItems} active records</span>
              <span>{selectedSummary.inactiveItems} missing records</span>
              <span>{completionPercentage}% ready</span>
            </div>
            <p className="muted-copy">
              Use Training Hub to update the worker’s required training dates one item at a time.
            </p>
          </div>
        )}
      </article>

      <article className="surface panel-stack">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{selectedWorkerId ? 'Edit worker' : 'Add worker'}</p>
            <h3>{selectedWorkerId ? 'Worker profile' : 'New worker profile'}</h3>
          </div>
          <button className="ghost-button" onClick={resetForm} type="button">
            Clear
          </button>
        </div>

        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="field">
            <span>Project</span>
            <select
              required
              value={form.company_id}
              onChange={(event) =>
                setForm((current) => ({ ...current, company_id: Number(event.target.value) }))
              }
            >
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Contractor</span>
            <select
              value={form.contractor_id ?? ''}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  contractor_id: event.target.value ? Number(event.target.value) : null,
                }))
              }
            >
              <option value="">Unassigned</option>
              {contractors
                .filter((contractor) => contractor.company_id === form.company_id)
                .map((contractor) => (
                  <option key={contractor.id} value={contractor.id}>
                    {contractor.name}
                  </option>
                ))}
            </select>
          </label>

          <label className="field">
            <span>Worker name</span>
            <input
              required
              value={form.full_name}
              onChange={(event) =>
                setForm((current) => ({ ...current, full_name: event.target.value }))
              }
            />
          </label>

          <label className="field">
            <span>Worker code</span>
            <input
              value={form.employee_code}
              onChange={(event) =>
                setForm((current) => ({ ...current, employee_code: event.target.value }))
              }
            />
          </label>

          <label className="field">
            <span>Job title</span>
            <input
              value={form.job_title}
              onChange={(event) =>
                setForm((current) => ({ ...current, job_title: event.target.value }))
              }
            />
          </label>

          <label className="field">
            <span>Worker status</span>
            <select
              value={form.onboarding_status}
              onChange={(event) =>
                setForm((current) => ({ ...current, onboarding_status: event.target.value }))
              }
            >
              <option value="active">Active</option>
              <option value="new">New</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>

          <label className="field">
            <span>Hire date</span>
            <input
              type="date"
              value={form.hire_date}
              onChange={(event) =>
                setForm((current) => ({ ...current, hire_date: event.target.value }))
              }
            />
          </label>

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            />
          </label>

          <label className="field">
            <span>Phone</span>
            <input
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            />
          </label>

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
              {busy ? 'Saving...' : selectedWorkerId ? 'Save worker' : 'Add worker'}
            </button>
            {selectedWorkerId && (
              <button className="danger-button" disabled={busy} type="button" onClick={handleDelete}>
                Delete worker
              </button>
            )}
          </div>
        </form>
      </article>
    </section>
  )
}
