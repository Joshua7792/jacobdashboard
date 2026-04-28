import { AlertTriangle, Clock, FileSpreadsheet, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import { useEffect, useState } from 'react'

import { api } from '../api'
import type {
  ExcelActionItem,
  ExcelDashboard,
  ExcelHeatmap,
  ExcelKPIs,
  ExcelStatus,
} from '../types'

// --- Helpers -----------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function relativeDays(days: number | null): string {
  if (days === null || days === undefined) return '—'
  if (days === 0) return 'today'
  if (days > 0) return `in ${days}d`
  return `${Math.abs(days)}d ago`
}

function statusLabel(s: ExcelStatus): string {
  switch (s) {
    case 'green':
      return 'Current'
    case 'yellow':
      return 'Renew soon'
    case 'red':
      return 'Urgent'
    default:
      return 'Missing'
  }
}

// --- Refresh control --------------------------------------------------------

type RefreshControlProps = {
  loadedAt: string
  workbookPath: string
  refreshing: boolean
  onRefresh: () => void
  errorMessage?: string | null
}

function RefreshControl({
  loadedAt,
  workbookPath,
  refreshing,
  onRefresh,
  errorMessage,
}: RefreshControlProps) {
  const fileName = workbookPath.split(/[\\/]/).pop() ?? workbookPath
  return (
    <div className="excel-refresh-bar surface">
      <div className="excel-refresh-info">
        <span className="excel-refresh-icon">
          <FileSpreadsheet size={18} />
        </span>
        <div>
          <p className="eyebrow">Workbook</p>
          <strong>{fileName}</strong>
          <p className="excel-refresh-meta">
            <Clock size={13} /> Last loaded {formatTime(loadedAt)}
          </p>
        </div>
      </div>
      <button
        type="button"
        className="primary-button excel-refresh-button"
        onClick={onRefresh}
        disabled={refreshing}
      >
        <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
        {refreshing ? 'Refreshing…' : 'Refresh'}
      </button>
      {errorMessage ? (
        <div className="excel-refresh-error">
          <AlertTriangle size={14} /> {errorMessage}
        </div>
      ) : null}
    </div>
  )
}

// --- KPI strip --------------------------------------------------------------

type KPIStripProps = { kpis: ExcelKPIs }

function KPIStrip({ kpis }: KPIStripProps) {
  const compliancePct = kpis.overall_compliance_pct
  const complianceTone =
    compliancePct >= 90 ? 'tone-good' : compliancePct >= 70 ? 'tone-warn' : 'tone-bad'

  return (
    <section className="excel-kpi-grid">
      <KPICard
        icon={<Users size={20} />}
        label="Active workers"
        value={kpis.active_workers}
        sub={`${kpis.total_workers} total · ${kpis.total_contractors} contractors`}
      />
      <KPICard
        icon={<ShieldCheck size={20} />}
        label="Overall compliance"
        value={`${compliancePct.toFixed(1)}%`}
        sub={`${kpis.green_count} current of ${kpis.green_count + kpis.yellow_count + kpis.red_count} dated certs`}
        tone={complianceTone}
      />
      <KPICard
        icon={<AlertTriangle size={20} />}
        label="Urgent (≤30d or past)"
        value={kpis.red_count}
        sub="Schedule renewal now"
        tone={kpis.red_count > 0 ? 'tone-bad' : 'tone-good'}
      />
      <KPICard
        icon={<Clock size={20} />}
        label="Expiring soon (31-60d)"
        value={kpis.yellow_count}
        sub="Plan ahead"
        tone={kpis.yellow_count > 0 ? 'tone-warn' : 'tone-good'}
      />
    </section>
  )
}

type KPICardProps = {
  icon: React.ReactNode
  label: string
  value: number | string
  sub: string
  tone?: 'tone-good' | 'tone-warn' | 'tone-bad'
}

function KPICard({ icon, label, value, sub, tone }: KPICardProps) {
  return (
    <article className={`excel-kpi-card surface ${tone ?? ''}`}>
      <div className="excel-kpi-icon">{icon}</div>
      <p className="eyebrow">{label}</p>
      <strong className="excel-kpi-value">{value}</strong>
      <p className="excel-kpi-sub">{sub}</p>
    </article>
  )
}

// --- Action list ------------------------------------------------------------

type ActionListProps = { items: ExcelActionItem[] }

function ActionList({ items }: ActionListProps) {
  const [contractorFilter, setContractorFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'red' | 'yellow'>('all')

  const contractors = Array.from(new Set(items.map((i) => i.contractor))).sort()
  const filtered = items.filter((i) => {
    if (contractorFilter !== 'all' && i.contractor !== contractorFilter) return false
    if (statusFilter !== 'all' && i.status !== statusFilter) return false
    return true
  })

  return (
    <section className="excel-action-section surface">
      <header className="excel-section-head">
        <div>
          <p className="eyebrow">Action list</p>
          <h3>What needs attention</h3>
          <p className="excel-section-sub">
            Closest to the renewal deadline at the top. {filtered.length} of {items.length}{' '}
            shown.
          </p>
        </div>
        <div className="excel-action-filters">
          <select
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
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'red' | 'yellow')}
          >
            <option value="all">All statuses</option>
            <option value="red">Urgent only</option>
            <option value="yellow">Renew soon only</option>
          </select>
        </div>
      </header>

      {filtered.length === 0 ? (
        <p className="excel-empty">Nothing urgent. Everything in scope is current.</p>
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
                    <span className={`status-pill status-${item.status}`}>
                      {statusLabel(item.status)}
                    </span>
                  </td>
                  <td className="excel-action-worker">{item.worker}</td>
                  <td className="excel-action-contractor">{item.contractor}</td>
                  <td>
                    <span className="excel-action-cert">{item.cert_name}</span>
                    <span className="excel-action-category">{item.cert_category}</span>
                  </td>
                  <td>{formatDate(item.completed_on)}</td>
                  <td>{formatDate(item.anniversary)}</td>
                  <td className="excel-action-days">{relativeDays(item.days_until_anniversary)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// --- Compliance heatmap -----------------------------------------------------

type HeatmapProps = { heatmap: ExcelHeatmap }

function ComplianceHeatmap({ heatmap }: HeatmapProps) {
  if (heatmap.rows.length === 0) {
    return (
      <section className="excel-heatmap-section surface">
        <header className="excel-section-head">
          <div>
            <p className="eyebrow">Compliance heatmap</p>
            <h3>Workers × certifications</h3>
          </div>
        </header>
        <p className="excel-empty">No workers in the workbook yet.</p>
      </section>
    )
  }

  return (
    <section className="excel-heatmap-section surface">
      <header className="excel-section-head">
        <div>
          <p className="eyebrow">Compliance heatmap</p>
          <h3>Workers × certifications</h3>
          <p className="excel-section-sub">
            Hover any cell for completion date and days remaining. Frozen first column scrolls
            independently.
          </p>
        </div>
        <div className="excel-heatmap-legend">
          <span className="status-pill status-green">Current</span>
          <span className="status-pill status-yellow">Renew soon</span>
          <span className="status-pill status-red">Urgent</span>
          <span className="status-pill status-blank">Missing</span>
        </div>
      </header>

      <div
        className="excel-heatmap-scroll"
        style={
          {
            // CSS variable for column count so the grid template adapts.
            '--cert-count': heatmap.cert_names.length,
          } as React.CSSProperties
        }
      >
        <div className="excel-heatmap-grid">
          {/* Header row: empty corner + cert names */}
          <div className="excel-heatmap-corner">
            <span className="eyebrow">Worker</span>
          </div>
          {heatmap.cert_names.map((name, i) => (
            <div
              key={`h-${i}`}
              className={`excel-heatmap-header excel-heatmap-header-${heatmap.cert_categories[i]
                ?.toLowerCase()
                .replace(/[^a-z]/g, '')}`}
              title={`${name} — ${heatmap.cert_categories[i]}`}
            >
              <span>{name}</span>
            </div>
          ))}

          {/* Data rows */}
          {heatmap.rows.map((row, rIdx) => (
            <RowFragment key={`r-${rIdx}`} row={row} />
          ))}
        </div>
      </div>
    </section>
  )
}

function RowFragment({ row }: { row: { worker: string; contractor: string; statuses: { status: ExcelStatus; completed_on: string | null; days_until_anniversary: number | null }[] } }) {
  return (
    <>
      <div className="excel-heatmap-rowhead">
        <strong>{row.worker}</strong>
        <span>{row.contractor}</span>
      </div>
      {row.statuses.map((cell, cIdx) => (
        <div
          key={`c-${cIdx}`}
          className={`excel-heatmap-cell status-${cell.status}`}
          title={
            cell.completed_on
              ? `Completed ${formatDate(cell.completed_on)} · ${relativeDays(cell.days_until_anniversary)}`
              : 'No date'
          }
        >
          {cell.completed_on ? (
            <span className="excel-heatmap-cell-text">
              {formatDate(cell.completed_on).split(',')[0].replace(/\s/g, ' ')}
            </span>
          ) : null}
        </div>
      ))}
    </>
  )
}

// --- Page -------------------------------------------------------------------

export function ExcelDashboardPage() {
  const [data, setData] = useState<ExcelDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load(force = false) {
    try {
      if (data) setRefreshing(true)
      else setLoading(true)
      setError(null)
      if (force) {
        await api.refreshExcelWorkbook()
      }
      const fresh = await api.getExcelDashboard()
      setData(fresh)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load dashboard')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading && !data) {
    return <div className="loading">Loading dashboard from Excel…</div>
  }

  if (error && !data) {
    return (
      <section className="surface excel-error-card">
        <AlertTriangle size={24} />
        <h3>Could not load the workbook</h3>
        <p>{error}</p>
        <button className="primary-button" onClick={() => load()} type="button">
          Try again
        </button>
      </section>
    )
  }

  if (!data) return null

  return (
    <div className="excel-dashboard">
      <RefreshControl
        loadedAt={data.workbook.loaded_at}
        workbookPath={data.workbook.path}
        refreshing={refreshing}
        onRefresh={() => load(true)}
        errorMessage={error}
      />
      <KPIStrip kpis={data.kpis} />
      <ActionList items={data.action_list} />
      <ComplianceHeatmap heatmap={data.heatmap} />
      {data.issues.length > 0 ? (
        <section className="surface excel-issues-card">
          <header>
            <AlertTriangle size={16} /> <strong>Data quality notes</strong>
          </header>
          <ul>
            {data.issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
