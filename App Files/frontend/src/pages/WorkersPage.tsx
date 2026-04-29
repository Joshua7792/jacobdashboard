// Workforce roster — every worker in the workbook with click-to-expand
// per-cert detail.
//
// We build the per-worker view from the heatmap rows in the dashboard
// payload (no extra round-trip needed) since the heatmap already carries
// each worker's full status array. Aggregates (green/yellow/red/blank
// counts and compliance %) are computed locally so we control rounding.
import { ChevronDown, ChevronRight, Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { PageShell } from '../components/PageShell'
import { StatusPill, StatusStackedBar } from '../components/StatusPill'
import { useDashboard } from '../context/DashboardContext'
import { formatDate, relativeDays, visualStatus } from '../lib/format'
import type { ExcelStatus } from '../types'

type SortMode = 'compliance-asc' | 'compliance-desc' | 'name' | 'urgent-desc'

// Aggregate per-worker numbers from the heatmap rows so we don't need an
// extra round-trip to /api/excel/workers.
type WorkerRow = {
  worker: string
  contractor: string
  jobTitle: string | null
  green: number
  yellow: number
  red: number
  blank: number
  total: number
  compliancePct: number
  certs: {
    name: string
    category: string
    status: ExcelStatus
    completedOn: string | null
    days: number | null
  }[]
}

export function WorkersPage() {
  const { data } = useDashboard()
  const [search, setSearch] = useState('')
  const [contractorFilter, setContractorFilter] = useState('all')
  const [sort, setSort] = useState<SortMode>('compliance-asc')
  const [expanded, setExpanded] = useState<string | null>(null)

  const workers: WorkerRow[] = useMemo(() => {
    if (!data) return []
    const heatmap = data.heatmap
    return heatmap.rows.map((row) => {
      let g = 0, y = 0, r = 0, b = 0
      const certs = row.statuses.map((cell, idx) => {
        if (cell.status === 'green') g++
        else if (cell.status === 'yellow') y++
        else if (cell.status === 'red') r++
        else b++
        return {
          name: heatmap.cert_names[idx],
          category: heatmap.cert_categories[idx],
          status: cell.status,
          completedOn: cell.completed_on,
          days: cell.days_until_anniversary,
        }
      })
      const dated = g + y + r
      return {
        worker: row.worker,
        contractor: row.contractor,
        jobTitle: row.job_title,
        green: g,
        yellow: y,
        red: r,
        blank: b,
        total: certs.length,
        compliancePct: dated > 0 ? (g / dated) * 100 : 0,
        certs,
      }
    })
  }, [data])

  const contractors = useMemo(
    () => Array.from(new Set(workers.map((w) => w.contractor))).sort(),
    [workers],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = workers
    if (contractorFilter !== 'all') {
      list = list.filter((w) => w.contractor === contractorFilter)
    }
    if (q) {
      list = list.filter(
        (w) =>
          w.worker.toLowerCase().includes(q) ||
          w.contractor.toLowerCase().includes(q),
      )
    }
    const copy = [...list]
    switch (sort) {
      case 'compliance-asc':
        copy.sort((a, b) => a.compliancePct - b.compliancePct)
        break
      case 'compliance-desc':
        copy.sort((a, b) => b.compliancePct - a.compliancePct)
        break
      case 'name':
        copy.sort((a, b) => a.worker.localeCompare(b.worker))
        break
      case 'urgent-desc':
        copy.sort((a, b) => b.red - a.red)
        break
    }
    return copy
  }, [workers, search, contractorFilter, sort])

  return (
    <PageShell
      eyebrow="Workforce"
      title="Worker roster"
      description="Search, sort, and click any worker to see every cert they hold and where they sit on the renewal clock."
      actions={
        <select
          aria-label="Sort workers"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
        >
          <option value="compliance-asc">Lowest compliance first</option>
          <option value="compliance-desc">Highest compliance first</option>
          <option value="urgent-desc">Most urgent items</option>
          <option value="name">Name (A–Z)</option>
        </select>
      }
    >
      <section className="surface card-padded">
        <div className="action-filter-bar">
          <label className="search-field">
            <Search size={14} />
            <input
              type="search"
              placeholder="Search worker or contractor"
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
          <span className="filter-result-count">
            {filtered.length} of {workers.length}
          </span>
        </div>

        {filtered.length === 0 ? (
          <p className="excel-empty">No workers match.</p>
        ) : (
          <div className="worker-table-wrap">
            <table className="worker-table">
              <thead>
                <tr>
                  <th>
                    <span className="visually-hidden">Expand row</span>
                  </th>
                  <th>Worker</th>
                  <th>Contractor</th>
                  <th>Compliance</th>
                  <th>Status mix</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((w) => {
                  const isOpen = expanded === w.worker
                  return (
                    <>
                      <tr
                        key={w.worker}
                        className={`worker-row ${isOpen ? 'worker-row-open' : ''}`}
                        onClick={() => setExpanded(isOpen ? null : w.worker)}
                      >
                        <td className="worker-row-toggle">
                          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </td>
                        <td>
                          <strong>{w.worker}</strong>
                          {w.jobTitle && <small>{w.jobTitle}</small>}
                        </td>
                        <td>{w.contractor}</td>
                        <td className="worker-pct-cell">
                          <strong>{w.compliancePct.toFixed(0)}%</strong>
                          <small>
                            {w.green}/{w.green + w.yellow + w.red} dated
                          </small>
                        </td>
                        <td>
                          <StatusStackedBar
                            green={w.green}
                            yellow={w.yellow}
                            red={w.red}
                            blank={w.blank}
                          />
                        </td>
                        <td className={w.red > 0 ? 'tone-bad-text' : ''}>{w.red}</td>
                      </tr>
                      {isOpen && (
                        <tr key={`${w.worker}-detail`} className="worker-row-detail">
                          <td colSpan={6}>
                            <div className="worker-cert-grid">
                              {w.certs.map((c) => (
                                <div key={c.name} className={`worker-cert-tile status-${visualStatus(c.status, c.days)}`}>
                                  <div className="worker-cert-tile-head">
                                    <strong>{c.name}</strong>
                                    <StatusPill status={visualStatus(c.status, c.days)} />
                                  </div>
                                  <p className="worker-cert-tile-meta">
                                    <span>{c.category}</span>
                                    <span>
                                      {c.completedOn
                                        ? `Completed ${formatDate(c.completedOn)}`
                                        : 'No date'}
                                    </span>
                                    <span>{relativeDays(c.days)}</span>
                                  </p>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PageShell>
  )
}
