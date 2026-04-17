import { FormEvent, useEffect, useState } from 'react'

import { api } from '../api'
import type { Company, Contractor } from '../types'

type ContractorsPageProps = {
  companies: Company[]
  selectedCompanyId: number | null
}

const emptyForm = {
  company_id: 0,
  name: '',
  primary_contact: '',
  budget_allocated: '0',
  notes: '',
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function ContractorsPage({ companies, selectedCompanyId }: ContractorsPageProps) {
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [form, setForm] = useState({
    ...emptyForm,
    company_id: selectedCompanyId ?? companies[0]?.id ?? 0,
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function loadContractors() {
    const params = new URLSearchParams()
    if (selectedCompanyId) params.set('company_id', String(selectedCompanyId))
    const data = await api.getContractorRecords(params)
    setContractors(data)
    setSelectedId((current) => (current && data.some((item) => item.id === current) ? current : null))
  }

  useEffect(() => {
    loadContractors().catch((error) =>
      setMessage(error instanceof Error ? error.message : 'Unable to load contractors'),
    )
  }, [selectedCompanyId])

  useEffect(() => {
    setForm((current) => ({
      ...current,
      company_id: current.company_id || selectedCompanyId || companies[0]?.id || 0,
    }))
  }, [selectedCompanyId, companies])

  function fillForm(contractor: Contractor | null) {
    if (!contractor) {
      setSelectedId(null)
      setForm({
        ...emptyForm,
        company_id: selectedCompanyId ?? companies[0]?.id ?? 0,
      })
      return
    }

    setSelectedId(contractor.id)
    setForm({
      company_id: contractor.company_id,
      name: contractor.name,
      primary_contact: contractor.primary_contact ?? '',
      budget_allocated: String(contractor.budget_allocated ?? 0),
      notes: contractor.notes ?? '',
    })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    try {
      setBusy(true)
      setMessage(null)
      const payload = {
        ...form,
        budget_allocated: Number(form.budget_allocated || 0),
        primary_contact: form.primary_contact || null,
        notes: form.notes || null,
      }
      if (selectedId) {
        await api.updateContractor(selectedId, payload)
        setMessage('Contractor updated.')
      } else {
        await api.createContractor(payload)
        setMessage('Contractor created.')
        fillForm(null)
      }
      await loadContractors()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save contractor')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!selectedId) return
    if (!window.confirm('Delete this contractor? Workers will become unassigned.')) return
    try {
      setBusy(true)
      await api.deleteContractor(selectedId)
      setMessage('Contractor deleted.')
      fillForm(null)
      await loadContractors()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to delete contractor')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="page-grid two-column">
      <article className="surface panel-stack">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Project contractors</p>
            <h3>Contractor groups</h3>
          </div>
          <button className="ghost-button" onClick={() => fillForm(null)} type="button">
            New contractor
          </button>
        </div>

        <div className="company-card-grid">
          {contractors.map((contractor) => (
            <button
              key={contractor.id}
              className={contractor.id === selectedId ? 'company-card active' : 'company-card'}
              onClick={() => fillForm(contractor)}
            >
              <strong>{contractor.name}</strong>
              <p>{contractor.primary_contact || contractor.company_name}</p>
              <div className="company-metrics">
                <span>{contractor.worker_count} workers</span>
                <span>{contractor.trainings_completed}/{contractor.trainings_required} complete</span>
                <span>{contractor.compliance_pct}% ready</span>
                <span>{formatCurrency(contractor.budget_allocated)} budget</span>
              </div>
            </button>
          ))}
        </div>
      </article>

      <article className="surface panel-stack">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{selectedId ? 'Edit contractor' : 'Create contractor'}</p>
            <h3>{selectedId ? 'Contractor profile' : 'New contractor profile'}</h3>
          </div>
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
            <span>Contractor name</span>
            <input
              required
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="GeoEnvirotech"
            />
          </label>

          <label className="field">
            <span>Primary contact</span>
            <input
              value={form.primary_contact}
              onChange={(event) =>
                setForm((current) => ({ ...current, primary_contact: event.target.value }))
              }
            />
          </label>

          <label className="field">
            <span>Budget allocated</span>
            <input
              min="0"
              step="1000"
              type="number"
              value={form.budget_allocated}
              onChange={(event) =>
                setForm((current) => ({ ...current, budget_allocated: event.target.value }))
              }
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
              {busy ? 'Saving...' : selectedId ? 'Save contractor' : 'Create contractor'}
            </button>
            {selectedId && (
              <button className="danger-button" disabled={busy} type="button" onClick={handleDelete}>
                Delete contractor
              </button>
            )}
          </div>
        </form>
      </article>
    </section>
  )
}
