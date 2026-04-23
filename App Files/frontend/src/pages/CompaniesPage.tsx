import { FormEvent, useEffect, useState } from 'react'

import { api } from '../api'
import type { Company } from '../types'

type CompaniesPageProps = {
  companies: Company[]
  onRefresh: () => Promise<void>
}

const emptyForm = {
  name: '',
  industry: '',
  primary_contact: '',
  notes: '',
}

export function CompaniesPage({ companies, onRefresh }: CompaniesPageProps) {
  const [selectedId, setSelectedId] = useState<number | null>(companies[0]?.id ?? null)
  const [form, setForm] = useState(emptyForm)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const selectedCompany = companies.find((company) => company.id === selectedId) ?? null

  useEffect(() => {
    if (!companies.length) {
      setSelectedId(null)
      return
    }

    if (selectedId && !companies.some((company) => company.id === selectedId)) {
      setSelectedId(null)
    }
  }, [companies, selectedId])

  function fillForm(company: Company | null) {
    if (!company) {
      setForm(emptyForm)
      setSelectedId(null)
      return
    }
    setSelectedId(company.id)
    setForm({
      name: company.name,
      industry: company.industry ?? '',
      primary_contact: company.primary_contact ?? '',
      notes: company.notes ?? '',
    })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    try {
      setBusy(true)
      setMessage(null)
      const payload = {
        ...form,
        industry: form.industry || null,
        primary_contact: form.primary_contact || null,
        notes: form.notes || null,
      }
      if (selectedId) {
        await api.updateCompany(selectedId, payload)
        setMessage('Company updated.')
      } else {
        await api.createCompany(payload)
        setMessage('Company created.')
        setForm(emptyForm)
      }
      await onRefresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save company')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!selectedId) return
    const confirmed = window.confirm('Delete this company and all its employees?')
    if (!confirmed) return
    try {
      setBusy(true)
      setMessage(null)
      await api.deleteCompany(selectedId)
      setForm(emptyForm)
      setSelectedId(null)
      setMessage('Company deleted.')
      await onRefresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to delete company')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="page-grid two-column">
      <article className="surface">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Company map</p>
            <h3>All companies</h3>
          </div>
          <button className="ghost-button" onClick={() => fillForm(null)}>
            New company
          </button>
        </div>
        <div className="company-card-grid">
          {companies.map((company) => (
            <button
              key={company.id}
              className={company.id === selectedId ? 'company-card active' : 'company-card'}
              onClick={() => fillForm(company)}
            >
              <strong>{company.name}</strong>
              <p>{company.industry || 'No industry set'}</p>
              <div className="company-metrics">
                <span>{company.contractor_count} contractors</span>
                <span>{company.worker_count} employees</span>
                <span>{company.training_count} required items</span>
                <span>{company.trainings_completed} completed</span>
              </div>
            </button>
          ))}
        </div>
      </article>

      <article className="surface">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{selectedCompany ? 'Edit company' : 'Create company'}</p>
            <h3>{selectedCompany?.name || 'New company profile'}</h3>
          </div>
        </div>

        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="field">
            <span>Company name</span>
            <input
              required
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Atlas Industrial Services"
            />
          </label>

          <label className="field">
            <span>Industry</span>
            <input
              value={form.industry}
              onChange={(event) =>
                setForm((current) => ({ ...current, industry: event.target.value }))
              }
              placeholder="Mechanical, industrial, electrical..."
            />
          </label>

          <label className="field">
            <span>Primary contact</span>
            <input
              value={form.primary_contact}
              onChange={(event) =>
                setForm((current) => ({ ...current, primary_contact: event.target.value }))
              }
              placeholder="Main contractor contact"
            />
          </label>

          <label className="field field-full">
            <span>Notes</span>
            <textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Anything helpful about this company"
            />
          </label>

          {message && <div className="info-banner field-full">{message}</div>}

          <div className="action-row field-full">
            <button className="primary-button" disabled={busy} type="submit">
              {busy ? 'Saving...' : selectedCompany ? 'Save company' : 'Create company'}
            </button>
            {selectedCompany && (
              <button className="danger-button" disabled={busy} type="button" onClick={handleDelete}>
                Delete company
              </button>
            )}
          </div>
        </form>
      </article>
    </section>
  )
}
