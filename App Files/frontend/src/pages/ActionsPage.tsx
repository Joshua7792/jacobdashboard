// Action Center — every cert that's already red or yellow, with filters.
//
// Backend serves action_list pre-sorted by abs(days_until_anniversary) so
// recent transitions surface first. We layer four UI filters on top:
//   - free-text search across worker + cert name
//   - contractor select
//   - status select (all / red only / yellow only)
//   - days-until-anniversary chip set (any / past due / ≤7d / ≤30d / ≤60d)
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { PageShell } from '../components/PageShell'
import { StatusPill } from '../components/StatusPill'
import { useDashboard } from '../context/DashboardContext'
import { formatDate, relativeDays, visualStatus } from '../lib/format'
import type { ExcelVisualStatus } from '../types'

type StatusFilter = 'all' | Extract<ExcelVisualStatus, 'yellow' | 'orange' | 'red'>
type WorkerStatusFilter = 'active' | 'inactive' | 'onboarding' | 'all'
type DaysBucket = 'all' | 'past' | 'le7' | 'le30' | 'le60'

function isActiveWorkerStatus(status: string | undefined) {
  const normalized = (status ?? 'active').toLowerCase()
  return normalized === 'active'
}

function workerStatusLabel(status: string | undefined) {
  const normalized = (status ?? 'active').toLowerCase()
  if (normalized === 'active') return 'Active'
  if (normalized === 'onboarding') return 'Onboarding'
  if (normalized === 'inactive') return 'Inactive'
  return status ?? 'Active'
}

export function ActionsPage() {
  const { data } = useDashboard()
  const [contractorFilter, setContractorFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [workerStatusFilter, setWorkerStatusFilter] = useState<WorkerStatusFilter>('active')
  const [daysBucket, setDaysBucket] = useState<DaysBucket>('all')
  const [search, setSearch] = useState('')

  const items = data?.action_list ?? []

  const scopedItems = useMemo(
    () =>
      workerStatusFilter === 'all'
        ? items
        : items.filter((i) => (i.worker_status ?? 'active').toLowerCase() === workerStatusFilter),
    [items, workerStatusFilter],
  )

  const contractors = useMemo(
    () => Array.from(new Set(scopedItems.map((i) => i.contractor))).sort(),
    [scopedItems],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return scopedItems.filter((i) => {
      if (contractorFilter !== 'all' && i.contractor !== contractorFilter) return false
      const displayStatus = visualStatus(i.status, i.days_until_anniversary)
      if (statusFilter !== 'all' && displayStatus !== statusFilter) return false
      if (
        q &&
        !i.worker.toLowerCase().includes(q) &&
        !i.cert_name.toLowerCase().includes(q) &&
        !workerStatusLabel(i.worker_status).toLowerCase().includes(q)
      ) {
        return false
      }
      const d = i.days_until_anniversary
      if (daysBucket !== 'all') {
        if (d === null || d === undefined) return false
        if (daysBucket === 'past' && d >= 0) return false
        if (daysBucket === 'le7' && (d < 0 || d > 7)) return false
        if (daysBucket === 'le30' && (d < 0 || d > 30)) return false
        if (daysBucket === 'le60' && (d < 0 || d > 60)) return false
      }
      return true
    })
  }, [scopedItems, contractorFilter, statusFilter, daysBucket, search])

  const overdueCount = filtered.filter(
    (i) => visualStatus(i.status, i.days_until_anniversary) === 'red',
  ).length
  const urgentCount = filtered.filter(
    (i) => visualStatus(i.status, i.days_until_anniversary) === 'orange',
  ).length
  const yellowCount = filtered.filter(
    (i) => visualStatus(i.status, i.days_until_anniversary) === 'yellow',
  ).length

  return (
    <PageShell
      eyebrow="Action center"
      title="Renewals on the runway"
      description="Every cert sliding into yellow or red, sorted by absolute days from anniversary so the most recent transitions float to the top."
    >
      <section className="surface card-padded">
        <div className="action-summary-row">
          <div className="action-summary-item">
            <p className="eyebrow">Showing</p>
            <strong>
              {filtered.length} of {scopedItems.length}
            </strong>
          </div>
          <div className="action-summary-item">
            <p className="eyebrow">Overdue</p>
            <strong className="tone-bad-text">{overdueCount}</strong>
          </div>
          <div className="action-summary-item">
            <p className="eyebrow">Urgent</p>
            <strong className="tone-urgent-text">{urgentCount}</strong>
          </div>
          <div className="action-summary-item">
            <p className="eyebrow">Renew soon</p>
            <strong className="tone-warn-text">{yellowCount}</strong>
          </div>
        </div>

        <div className="action-filter-bar">
          <label className="search-field">
            <Search size={14} />
            <input
              type="search"
              placeholder="Search worker or cert"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            aria-label="Filter by contractor"
            value={contractorFilter}
            onChange={(e) => setContractorFilter(e.target.value)}
          >
            <option value="all">All contractors</option>
            {contractors.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by worker status"
            value={workerStatusFilter}
            onChange={(e) => setWorkerStatusFilter(e.target.value as WorkerStatusFilter)}
          >
            <option value="active">Active workers</option>
            <option value="inactive">Inactive workers</option>
            <option value="onboarding">Onboarding workers</option>
            <option value="all">All worker statuses</option>
          </select>
          <select
            aria-label="Filter by certification status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">All cert statuses</option>
            <option value="red">Overdue only</option>
            <option value="orange">Urgent only</option>
            <option value="yellow">Renew soon only</option>
          </select>
          <div className="filter-chips">
            {(
              [
                ['all', 'Any time'],
                ['past', 'Past due'],
                ['le7', '≤ 7d'],
                ['le30', '≤ 30d'],
                ['le60', '≤ 60d'],
              ] as [DaysBucket, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`chip ${daysBucket === key ? 'chip-active' : ''}`}
                onClick={() => setDaysBucket(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="excel-empty">Nothing matches these filters.</p>
        ) : (
          <div className="excel-action-table-wrap">
            <table className="excel-action-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Worker</th>
                  <th>Contractor</th>
                  <th>Certification</th>
                  <th>Completed</th>
                  <th>Anniversary</th>
                  <th>Days</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => (
                  <tr key={`${item.worker}-${item.cert_name}-${idx}`}>
                    <td>
                      <StatusPill status={visualStatus(item.status, item.days_until_anniversary)} />
                    </td>
                    <td className="excel-action-worker">
                      <strong>{item.worker}</strong>
                      <span
                        className={`worker-status-badge ${
                          isActiveWorkerStatus(item.worker_status)
                            ? 'worker-status-active'
                            : 'worker-status-inactive'
                        }`}
                      >
                        {workerStatusLabel(item.worker_status)}
                      </span>
                    </td>
                    <td className="excel-action-contractor">{item.contractor}</td>
                    <td>
                      <span className="excel-action-cert">{item.cert_name}</span>
                      <span className="excel-action-category">{item.cert_category}</span>
                    </td>
                    <td>{formatDate(item.completed_on)}</td>
                    <td>{formatDate(item.anniversary)}</td>
                    <td className="excel-action-days">
                      {relativeDays(item.days_until_anniversary)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PageShell>
  )
}
