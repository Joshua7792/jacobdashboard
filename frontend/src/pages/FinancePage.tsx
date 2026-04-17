import { FormEvent, useEffect, useState } from 'react'

import { api } from '../api'
import type { Company, Contractor } from '../types'

type FinancePageProps = {
  companies: Company[]
  selectedCompanyId: number | null
  onRefreshCompanies: () => Promise<void>
}

type AllocationDrafts = Record<number, string>

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatCompactCurrency(value: number) {
  const absoluteValue = Math.abs(value)
  const sign = value < 0 ? '-' : ''

  if (absoluteValue >= 1_000_000_000) {
    return `${sign}$${(absoluteValue / 1_000_000_000).toFixed(1).replace(/\\.0$/, '')}B`
  }

  if (absoluteValue >= 1_000_000) {
    return `${sign}$${(absoluteValue / 1_000_000).toFixed(1).replace(/\\.0$/, '')}M`
  }

  if (absoluteValue >= 1_000) {
    return `${sign}$${(absoluteValue / 1_000).toFixed(1).replace(/\\.0$/, '')}K`
  }

  return `${sign}$${absoluteValue.toFixed(0)}`
}

function usageBadgeClass(usagePct: number, remaining: number) {
  if (remaining < 0) return 'badge-expired'
  if (usagePct >= 80) return 'badge-expiring'
  return 'badge-valid'
}

function gaugeTone(usagePct: number, remaining: number) {
  if (remaining < 0) return 'danger'
  if (usagePct >= 80) return 'warning'
  return 'safe'
}

function BudgetGauge({ used, cap }: { used: number; cap: number }) {
  const safeCap = cap > 0 ? cap : 1
  const clampedRatio = Math.max(0, Math.min(used / safeCap, 1))
  const usagePct = Math.round(clampedRatio * 100)
  const tone = gaugeTone(usagePct, safeCap - used)
  const angle = Math.PI * (1 - clampedRatio)
  const needleX = 200 + 112 * Math.cos(angle)
  const needleY = 220 - 112 * Math.sin(angle)
  const progressX = 200 + 160 * Math.cos(angle)
  const progressY = 220 - 160 * Math.sin(angle)
  const progressPath =
    clampedRatio > 0
      ? `M 40 220 A 160 160 0 0 1 ${progressX} ${progressY}`
      : ''

  return (
    <div className="budget-gauge-shell">
      <svg className="budget-gauge" viewBox="0 0 400 280" role="img" aria-label="Project budget gauge">
        <defs>
          <linearGradient id="budget-progress" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="70%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>
        <path d="M 40 220 A 160 160 0 0 1 360 220" className="budget-gauge-track" />
        <path d="M 40 220 A 160 160 0 0 1 88 106.9" className="budget-gauge-zone budget-gauge-zone-safe" />
        <path d="M 88 106.9 A 160 160 0 0 1 309.4 68.3" className="budget-gauge-zone budget-gauge-zone-warning" />
        <path d="M 309.4 68.3 A 160 160 0 0 1 360 220" className="budget-gauge-zone budget-gauge-zone-danger" />
        {progressPath && <path d={progressPath} className="budget-gauge-progress" />}
        <line
          x1="200"
          y1="220"
          x2={needleX}
          y2={needleY}
          className={`budget-gauge-needle budget-gauge-needle-${tone}`}
        />
        <circle cx="200" cy="220" r="10" className={`budget-gauge-hub budget-gauge-hub-${tone}`} />
        <text x="40" y="250" className="budget-gauge-scale">
          $0
        </text>
        <text x="200" y="54" className="budget-gauge-scale budget-gauge-scale-mid">
          {formatCompactCurrency(safeCap / 2)}
        </text>
        <text x="360" y="250" className="budget-gauge-scale budget-gauge-scale-end">
          {formatCompactCurrency(safeCap)}
        </text>
      </svg>

      <div className="budget-gauge-readout">
        <span>{tone === 'danger' ? 'Budget critical' : tone === 'warning' ? 'Budget caution' : 'Budget safe'}</span>
        <strong>{formatCurrency(used)}</strong>
        <p>
          {tone === 'danger'
            ? 'The project is at or beyond the red zone near the budget cap.'
            : tone === 'warning'
              ? 'The gauge is in the caution zone. Review new allocations before assigning more.'
              : 'The project is still in the safe zone. The needle rises as contractor allocations grow.'}
        </p>
      </div>
    </div>
  )
}

export function FinancePage({
  companies,
  selectedCompanyId,
  onRefreshCompanies,
}: FinancePageProps) {
  const currentCompany =
    companies.find((company) => company.id === selectedCompanyId) ?? companies[0] ?? null

  const [contractors, setContractors] = useState<Contractor[]>([])
  const [budgetCapDraft, setBudgetCapDraft] = useState(
    String(currentCompany?.budget_cap ?? 200_000_000),
  )
  const [allocationDrafts, setAllocationDrafts] = useState<AllocationDrafts>({})
  const [loading, setLoading] = useState(true)
  const [savingCap, setSavingCap] = useState(false)
  const [savingContractorId, setSavingContractorId] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function loadContractors() {
    if (!currentCompany) {
      setContractors([])
      setLoading(false)
      return
    }

    const params = new URLSearchParams({ company_id: String(currentCompany.id) })
    try {
      setLoading(true)
      const data = await api.getContractorRecords(params)
      setContractors(data)
      setAllocationDrafts(
        Object.fromEntries(
          data.map((contractor) => [contractor.id, String(contractor.budget_allocated ?? 0)]),
        ),
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadContractors().catch((error) =>
      setMessage(error instanceof Error ? error.message : 'Unable to load financial records'),
    )
  }, [currentCompany?.id])

  useEffect(() => {
    setBudgetCapDraft(String(currentCompany?.budget_cap ?? 200_000_000))
  }, [currentCompany?.budget_cap, currentCompany?.id])

  const committedBudget = contractors.reduce(
    (total, contractor) => total + (contractor.budget_allocated ?? 0),
    0,
  )
  const budgetCap = currentCompany?.budget_cap ?? 0
  const remainingBudget = budgetCap - committedBudget
  const usagePct = budgetCap > 0 ? Math.round((committedBudget / budgetCap) * 100) : 0
  const sortedContractors = [...contractors].sort(
    (left, right) =>
      right.budget_allocated - left.budget_allocated || left.name.localeCompare(right.name),
  )

  async function handleSaveCap(event: FormEvent) {
    event.preventDefault()
    if (!currentCompany) return

    try {
      setSavingCap(true)
      setMessage(null)
      await api.updateCompany(currentCompany.id, {
        name: currentCompany.name,
        industry: currentCompany.industry,
        primary_contact: currentCompany.primary_contact,
        budget_cap: Number(budgetCapDraft || 0),
        notes: currentCompany.notes,
      })
      await onRefreshCompanies()
      setMessage('Project budget cap updated.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update the budget cap')
    } finally {
      setSavingCap(false)
    }
  }

  async function saveContractorBudget(contractor: Contractor, nextAmount: number) {
    try {
      setSavingContractorId(contractor.id)
      setMessage(null)
      await api.updateContractor(contractor.id, {
        company_id: contractor.company_id,
        name: contractor.name,
        primary_contact: contractor.primary_contact,
        budget_allocated: nextAmount,
        notes: contractor.notes,
      })
      await Promise.all([loadContractors(), onRefreshCompanies()])
      setMessage(`Saved ${contractor.name} budget.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save contractor budget')
    } finally {
      setSavingContractorId(null)
    }
  }

  return (
    <section className="page-grid">
      <article className="surface audit-hero">
        <div>
          <p className="eyebrow">Financial area</p>
          <h3>{currentCompany?.name || 'Project'} budget control</h3>
          <p className="hero-copy">
            Set the maximum cap for the project, assign money to each contractor, and watch the
            gauge rise as more of the budget is committed. This gives you a fast visual read on
            how much is already being used and how much is left.
          </p>
        </div>

        <div className="audit-stat-grid compact-audit-grid">
          <div className="audit-stat-tile">
            <span>Budget cap</span>
            <strong>{formatCurrency(budgetCap)}</strong>
          </div>
          <div className="audit-stat-tile">
            <span>Committed</span>
            <strong>{formatCurrency(committedBudget)}</strong>
          </div>
          <div className="audit-stat-tile">
            <span>{remainingBudget >= 0 ? 'Remaining' : 'Over cap'}</span>
            <strong>{formatCurrency(Math.abs(remainingBudget))}</strong>
          </div>
          <div className="audit-stat-tile">
            <span>Usage</span>
            <strong>{usagePct}%</strong>
          </div>
        </div>
      </article>

      {message && <div className="info-banner">{message}</div>}

      <div className="page-grid two-column finance-grid">
        <article className="surface panel-stack">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Budget meter</p>
              <h3>Project gauge</h3>
            </div>
            <span className={`badge ${usageBadgeClass(usagePct, remainingBudget)}`}>
              {remainingBudget < 0 ? 'Over cap' : `${usagePct}% used`}
            </span>
          </div>

          <BudgetGauge used={committedBudget} cap={budgetCap} />

          <div className="budget-zone-legend">
            <div className="legend-item">
              <div>
                <span className="legend-swatch legend-swatch-safe" />
                Safe zone
              </div>
              <strong>0% to 59%</strong>
            </div>
            <div className="legend-item">
              <div>
                <span className="legend-swatch legend-swatch-warning" />
                Caution zone
              </div>
              <strong>60% to 84%</strong>
            </div>
            <div className="legend-item">
              <div>
                <span className="legend-swatch legend-swatch-danger" />
                Critical zone
              </div>
              <strong>85% to 100%+</strong>
            </div>
          </div>

          <div className="budget-summary-grid">
            <div className="scope-chip active">
              <strong>{formatCurrency(committedBudget)}</strong>
              <span>Allocated to contractors</span>
            </div>
            <div className="scope-chip">
              <strong>{formatCurrency(Math.max(remainingBudget, 0))}</strong>
              <span>Available to assign</span>
            </div>
            <div className="scope-chip">
              <strong>{contractors.length}</strong>
              <span>Contractors on the meter</span>
            </div>
          </div>

          <form className="finance-cap-form" onSubmit={handleSaveCap}>
            <label className="field">
              <span>Project budget cap</span>
              <input
                min="0"
                step="1000"
                type="number"
                value={budgetCapDraft}
                onChange={(event) => setBudgetCapDraft(event.target.value)}
              />
            </label>
            <button className="primary-button" disabled={savingCap} type="submit">
              {savingCap ? 'Saving cap...' : 'Save cap'}
            </button>
          </form>
        </article>

        <article className="surface panel-stack">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Contractor allocations</p>
              <h3>Who is using the budget</h3>
            </div>
          </div>

          {loading && <div className="loading">Loading contractor budgets...</div>}
          {!loading && sortedContractors.length === 0 && (
            <div className="empty-copy">No contractors available yet.</div>
          )}

          <div className="finance-contractor-grid">
            {sortedContractors.map((contractor) => {
              const draftValue = allocationDrafts[contractor.id] ?? String(contractor.budget_allocated ?? 0)
              const contractorPct = budgetCap > 0 ? Math.min((contractor.budget_allocated / budgetCap) * 100, 100) : 0
              const disabled = savingContractorId === contractor.id
              return (
                <div key={contractor.id} className="surface nested-surface finance-contractor-card">
                  <div className="worker-card-header">
                    <div>
                      <strong>{contractor.name}</strong>
                      <p>
                        {contractor.worker_count} workers • {contractor.compliance_pct}% workforce ready
                      </p>
                    </div>
                    <span className="amount-pill">{formatCurrency(contractor.budget_allocated)}</span>
                  </div>

                  <div className="budget-bar-track">
                    <div className="budget-bar-fill" style={{ width: `${contractorPct}%` }} />
                  </div>

                  <p className="muted-copy">
                    {budgetCap > 0 ? `${contractorPct.toFixed(1)}% of the full project cap` : 'Set a cap to measure share'}
                  </p>

                  <div className="finance-inline-form">
                    <label className="field">
                      <span>Allocated amount</span>
                      <input
                        min="0"
                        step="1000"
                        type="number"
                        value={draftValue}
                        onChange={(event) =>
                          setAllocationDrafts((current) => ({
                            ...current,
                            [contractor.id]: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <div className="matrix-actions">
                      <button
                        className="primary-button"
                        disabled={disabled}
                        type="button"
                        onClick={() => saveContractorBudget(contractor, Number(draftValue || 0))}
                      >
                        {disabled ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        className="ghost-button"
                        disabled={disabled}
                        type="button"
                        onClick={() => {
                          setAllocationDrafts((current) => ({ ...current, [contractor.id]: '0' }))
                          saveContractorBudget(contractor, 0).catch(() => null)
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </article>
      </div>
    </section>
  )
}
