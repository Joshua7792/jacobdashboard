import { FormEvent, useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { api } from '../api'
import type { Company, Contractor } from '../types'

type FinancePageProps = {
  companies: Company[]
  selectedCompanyId: number | null
  onRefreshCompanies: () => Promise<void>
}

type AllocationDrafts = Record<number, string>

const CAUTION_THRESHOLD_PCT = 60
const CRITICAL_THRESHOLD_PCT = 85

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
    return `${sign}$${(absoluteValue / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`
  }

  if (absoluteValue >= 1_000_000) {
    return `${sign}$${(absoluteValue / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  }

  if (absoluteValue >= 1_000) {
    return `${sign}$${(absoluteValue / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  }

  return `${sign}$${absoluteValue.toFixed(0)}`
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`
}

function formatTooltipCurrency(value: number | string | undefined) {
  return formatCurrency(Number(value ?? 0))
}

function getBudgetHealth(usagePct: number, remaining: number) {
  if (remaining < 0) {
    return {
      badgeClass: 'badge-expired',
      label: 'Over cap',
      narrative: 'Committed dollars are above the approved budget cap. Reduce allocations or approve a change order immediately.',
      toneClass: 'tone-danger',
    }
  }

  if (usagePct >= CRITICAL_THRESHOLD_PCT) {
    return {
      badgeClass: 'badge-expiring',
      label: 'Critical zone',
      narrative: 'Budget usage is inside the critical band. New contractor allocations should be reviewed before approval.',
      toneClass: 'tone-danger',
    }
  }

  if (usagePct >= CAUTION_THRESHOLD_PCT) {
    return {
      badgeClass: 'badge-warning',
      label: 'Caution zone',
      narrative: 'Budget usage is trending high. Track remaining headroom closely and monitor large contractor adjustments.',
      toneClass: 'tone-warning',
    }
  }

  return {
    badgeClass: 'badge-valid',
    label: 'Safe zone',
    narrative: 'Budget usage remains inside the safe band, with room available for future contractor assignments.',
    toneClass: 'tone-safe',
  }
}

function BudgetOverviewChart({
  cap,
  health,
  used,
}: {
  cap: number
  health: ReturnType<typeof getBudgetHealth>
  used: number
}) {
  const withinCap = cap > 0 ? Math.min(used, cap) : 0
  const remaining = cap > 0 ? Math.max(cap - used, 0) : 0
  const overCap = Math.max(used - cap, 0)
  const chartMax = Math.max(cap, used, 1)
  const chartData = [
    {
      label: 'Budget',
      over_cap: overCap,
      remaining,
      used: withinCap,
    },
  ]

  return (
    <div className="budget-overview-stack">
      <div className="budget-overview-chart">
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 18, right: 12, bottom: 18, left: 12 }}>
            <CartesianGrid horizontal={false} stroke="#dbe4ff" strokeDasharray="4 4" />
            <XAxis
              axisLine={false}
              domain={[0, chartMax]}
              tickFormatter={(value) => formatCompactCurrency(Number(value))}
              tickLine={false}
              type="number"
            />
            <YAxis axisLine={false} dataKey="label" hide tickLine={false} type="category" />
            {cap > 0 && (
              <>
                <ReferenceLine
                  ifOverflow="extendDomain"
                  label={{ fill: '#8f5b00', fontSize: 11, value: '60%' }}
                  stroke="#f59e0b"
                  strokeDasharray="6 6"
                  x={cap * (CAUTION_THRESHOLD_PCT / 100)}
                />
                <ReferenceLine
                  ifOverflow="extendDomain"
                  label={{ fill: '#9a3412', fontSize: 11, value: '85%' }}
                  stroke="#fb7185"
                  strokeDasharray="6 6"
                  x={cap * (CRITICAL_THRESHOLD_PCT / 100)}
                />
                <ReferenceLine
                  ifOverflow="extendDomain"
                  label={{ fill: '#1d4ed8', fontSize: 11, value: 'Cap' }}
                  stroke="#1d4ed8"
                  strokeDasharray="2 6"
                  x={cap}
                />
              </>
            )}
            <Tooltip
              formatter={(value: number | string | undefined, name: string) => {
                const labelMap: Record<string, string> = {
                  over_cap: 'Over cap',
                  remaining: 'Remaining',
                  used: 'Allocated',
                }
                return [formatTooltipCurrency(value), labelMap[name] ?? name]
              }}
              labelFormatter={() => 'Budget overview'}
            />
            <Bar dataKey="used" fill="#2563eb" radius={[10, 0, 0, 10]} stackId="budget" />
            <Bar dataKey="remaining" fill="#bfdbfe" radius={overCap > 0 ? [0, 0, 0, 0] : [0, 10, 10, 0]} stackId="budget" />
            <Bar dataKey="over_cap" fill="#ef4444" radius={[0, 10, 10, 0]} stackId="budget" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="budget-chart-caption">
        <span className={health.toneClass}>{health.label}</span>
        <strong>{formatCurrency(used)}</strong>
        <p>{health.narrative}</p>
      </div>
    </div>
  )
}

function ContractorAllocationChart({
  budgetCap,
  contractors,
}: {
  budgetCap: number
  contractors: Contractor[]
}) {
  const chartRows = contractors
    .filter((contractor) => contractor.budget_allocated > 0)
    .slice(0, 8)
    .reverse()
    .map((contractor) => ({
      allocation: contractor.budget_allocated,
      name: contractor.name,
      shareOfCap: budgetCap > 0 ? (contractor.budget_allocated / budgetCap) * 100 : 0,
    }))

  if (chartRows.length === 0) {
    return <div className="empty-copy">Add contractor allocations to populate the ranking chart.</div>
  }

  return (
    <div className="contractor-chart-shell">
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartRows} layout="vertical" margin={{ top: 6, right: 12, bottom: 6, left: 12 }}>
          <CartesianGrid stroke="#dbe4ff" strokeDasharray="4 4" />
          <XAxis
            axisLine={false}
            tickFormatter={(value) => formatCompactCurrency(Number(value))}
            tickLine={false}
            type="number"
          />
          <YAxis axisLine={false} dataKey="name" tickLine={false} type="category" width={120} />
          <Tooltip
            formatter={(value: number | string | undefined) => [formatTooltipCurrency(value), 'Allocated']}
            labelFormatter={(label) => String(label)}
          />
          <Bar dataKey="allocation" fill="#1d4ed8" radius={[0, 10, 10, 0]} />
        </BarChart>
      </ResponsiveContainer>
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
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  async function loadContractors(options?: { syncDrafts?: boolean }) {
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
      setLastUpdated(
        new Intl.DateTimeFormat('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
        }).format(new Date()),
      )

      if (options?.syncDrafts ?? true) {
        setAllocationDrafts(
          Object.fromEntries(
            data.map((contractor) => [contractor.id, String(contractor.budget_allocated ?? 0)]),
          ),
        )
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    Promise.all([loadContractors({ syncDrafts: true }), onRefreshCompanies()]).catch((error) =>
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
  const budgetHealth = getBudgetHealth(usagePct, remainingBudget)
  const sortedContractors = [...contractors].sort(
    (left, right) =>
      right.budget_allocated - left.budget_allocated || left.name.localeCompare(right.name),
  )
  const fundedContractors = sortedContractors.filter((contractor) => contractor.budget_allocated > 0)
  const topContractor = fundedContractors[0] ?? null
  const topThreeTotal = fundedContractors
    .slice(0, 3)
    .reduce((total, contractor) => total + contractor.budget_allocated, 0)
  const topThreeShareOfCommitted = committedBudget > 0 ? (topThreeTotal / committedBudget) * 100 : 0
  const headroomToCritical = Math.max(budgetCap * (CRITICAL_THRESHOLD_PCT / 100) - committedBudget, 0)
  const headroomToCap = Math.max(budgetCap - committedBudget, 0)

  async function handleSaveCap(event: FormEvent) {
    event.preventDefault()
    if (!currentCompany) return

    try {
      setSavingCap(true)
      setMessage(null)
      await api.updateCompany(currentCompany.id, {
        budget_cap: Number(budgetCapDraft || 0),
        industry: currentCompany.industry,
        name: currentCompany.name,
        notes: currentCompany.notes,
        primary_contact: currentCompany.primary_contact,
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
    const previousContractors = contractors

    try {
      setSavingContractorId(contractor.id)
      setMessage(null)
      setContractors((current) =>
        current.map((row) =>
          row.id === contractor.id
            ? {
                ...row,
                budget_allocated: nextAmount,
              }
            : row,
        ),
      )
      setAllocationDrafts((current) => ({
        ...current,
        [contractor.id]: String(nextAmount),
      }))

      await api.updateContractor(contractor.id, {
        budget_allocated: nextAmount,
        company_id: contractor.company_id,
        name: contractor.name,
        notes: contractor.notes,
        primary_contact: contractor.primary_contact,
      })
      await Promise.all([loadContractors({ syncDrafts: true }), onRefreshCompanies()])
      setMessage(`Saved ${contractor.name} budget.`)
    } catch (error) {
      setContractors(previousContractors)
      await loadContractors({ syncDrafts: true }).catch(() => null)
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
            A live budget command center for contractor allocations, remaining capacity, threshold
            exposure, and concentration risk.
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
              <p className="eyebrow">Budget utilization</p>
              <h3>Project budget overview</h3>
            </div>
            <div className="finance-heading-meta">
              <span className={`badge ${budgetHealth.badgeClass}`}>
                {remainingBudget < 0 ? 'Over cap' : `${usagePct}% used`}
              </span>
              {lastUpdated && <span className="muted-copy">Live snapshot {lastUpdated}</span>}
            </div>
          </div>

          <BudgetOverviewChart cap={budgetCap} health={budgetHealth} used={committedBudget} />

          <div className="budget-threshold-grid">
            <div className="threshold-card">
              <span>Safe band</span>
              <strong>0% to 59%</strong>
            </div>
            <div className="threshold-card">
              <span>Caution band</span>
              <strong>60% to 84%</strong>
            </div>
            <div className="threshold-card">
              <span>Critical band</span>
              <strong>85% to 100%+</strong>
            </div>
          </div>

          <div className="budget-summary-grid">
            <div className="scope-chip active">
              <strong>{formatCurrency(committedBudget)}</strong>
              <span>Allocated to contractors</span>
            </div>
            <div className="scope-chip">
              <strong>{formatCurrency(headroomToCap)}</strong>
              <span>Available before hitting cap</span>
            </div>
            <div className="scope-chip">
              <strong>{formatCurrency(headroomToCritical)}</strong>
              <span>Available before the 85% critical line</span>
            </div>
          </div>

          <div className="finance-insight-grid">
            <div className="surface nested-surface finance-insight-card">
              <span>Largest allocation</span>
              <strong>{topContractor ? topContractor.name : 'No contractor funded'}</strong>
              <p>
                {topContractor
                  ? `${formatCurrency(topContractor.budget_allocated)} assigned to the largest contractor.`
                  : 'No contractor budget has been committed yet.'}
              </p>
            </div>
            <div className="surface nested-surface finance-insight-card">
              <span>Concentration</span>
              <strong>{committedBudget > 0 ? formatPercent(topThreeShareOfCommitted) : '0.0%'}</strong>
              <p>Share of committed budget held by the top three contractor allocations.</p>
            </div>
            <div className="surface nested-surface finance-insight-card">
              <span>Funded contractors</span>
              <strong>
                {fundedContractors.length} of {contractors.length}
              </strong>
              <p>Contractors with a non-zero allocation against the project budget.</p>
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

          <ContractorAllocationChart budgetCap={budgetCap} contractors={sortedContractors} />

          <div className="finance-audit-notes">
            <div className="surface nested-surface finance-note-card">
              <strong>Allocation ranking</strong>
              <p>The chart ranks the highest-funded contractors first so review meetings can focus on the biggest exposures.</p>
            </div>
            <div className="surface nested-surface finance-note-card">
              <strong>Cap share visibility</strong>
              <p>Each contractor card below shows how much of the full project cap that allocation consumes.</p>
            </div>
          </div>

          {loading && <div className="loading">Loading contractor budgets...</div>}
          {!loading && sortedContractors.length === 0 && (
            <div className="empty-copy">No contractors available yet.</div>
          )}

          <div className="finance-contractor-grid">
            {sortedContractors.map((contractor) => {
              const draftValue =
                allocationDrafts[contractor.id] ?? String(contractor.budget_allocated ?? 0)
              const contractorPct =
                budgetCap > 0
                  ? Math.min((contractor.budget_allocated / budgetCap) * 100, 100)
                  : 0
              const disabled = savingContractorId === contractor.id
              return (
                <div key={contractor.id} className="surface nested-surface finance-contractor-card">
                  <div className="worker-card-header">
                    <div>
                      <strong>{contractor.name}</strong>
                      <p>
                        {contractor.worker_count} workers - {contractor.compliance_pct}% workforce
                        ready
                      </p>
                    </div>
                    <span className="amount-pill">{formatCurrency(contractor.budget_allocated)}</span>
                  </div>

                  <div className="budget-bar-track">
                    <div className="budget-bar-fill" style={{ width: `${contractorPct}%` }} />
                  </div>

                  <p className="muted-copy">
                    {budgetCap > 0
                      ? `${formatPercent(contractorPct)} of the full project cap`
                      : 'Set a cap to measure share'}
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
