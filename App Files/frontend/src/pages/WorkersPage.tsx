// Workforce roster — every worker in the workbook with click-to-expand
// per-cert detail.
//
// We build the per-worker view from the heatmap rows in the dashboard
// payload (no extra round-trip needed) since the heatmap already carries
// each worker's full status array. Aggregates (green/yellow/red/blank
// counts and compliance %) are computed locally so we control rounding.
import { ChevronDown, ChevronRight, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PageShell } from '../components/PageShell'
import { StatusPill, StatusStackedBar } from '../components/StatusPill'
import { useDashboard } from '../context/DashboardContext'
import { formatDate, relativeDays, visualStatus } from '../lib/format'
import type { ExcelStatus } from '../types'

type SortMode = 'compliance-asc' | 'compliance-desc' | 'name' | 'urgent-desc'

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
  const { t, i18n } = useTranslation()
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
      eyebrow={t('workers.eyebrow')}
      title={t('workers.title')}
      description={t('workers.description')}
      actions={
        <select
          aria-label={t('filter.sort_workers')}
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
        >
          <option value="compliance-asc">{t('workers.sort_compliance_asc')}</option>
          <option value="compliance-desc">{t('workers.sort_compliance_desc')}</option>
          <option value="urgent-desc">{t('workers.sort_urgent_desc')}</option>
          <option value="name">{t('workers.sort_name')}</option>
        </select>
      }
    >
      <section className="surface card-padded">
        <div className="action-filter-bar">
          <label className="search-field">
            <Search size={14} />
            <input
              type="search"
              placeholder={t('workers.search_placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            aria-label={t('filter.by_contractor')}
            value={contractorFilter}
            onChange={(e) => setContractorFilter(e.target.value)}
          >
            <option value="all">{t('actions.filter_contractor_all')}</option>
            {contractors.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <span className="filter-result-count">
            {t('workers.result_count', { filtered: filtered.length, total: workers.length })}
          </span>
        </div>

        {filtered.length === 0 ? (
          <p className="excel-empty">{t('workers.empty')}</p>
        ) : (
          <div className="worker-table-wrap">
            <table className="worker-table">
              <thead>
                <tr>
                  <th>
                    <span className="visually-hidden">{t('workers.expand_row')}</span>
                  </th>
                  <th>{t('workers.col_worker')}</th>
                  <th>{t('workers.col_contractor')}</th>
                  <th>{t('workers.col_compliance')}</th>
                  <th>{t('workers.col_status_mix')}</th>
                  <th>{t('workers.col_urgent')}</th>
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
                            {t('workers.dated_label', {
                              green: w.green,
                              total: w.green + w.yellow + w.red,
                            })}
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
                              {w.certs.map((c) => {
                                const visual = visualStatus(c.status, c.days)
                                return (
                                  <div
                                    key={c.name}
                                    className={`worker-cert-tile status-${visual}`}
                                  >
                                    <div className="worker-cert-tile-head">
                                      <strong>{c.name}</strong>
                                      <StatusPill status={visual} />
                                    </div>
                                    <p className="worker-cert-tile-meta">
                                      <span>{c.category}</span>
                                      <span>
                                        {c.completedOn
                                          ? t('workers.completed_on', {
                                              date: formatDate(c.completedOn, i18n.language),
                                            })
                                          : t('workers.no_date')}
                                      </span>
                                      <span>{relativeDays(c.days, t)}</span>
                                    </p>
                                  </div>
                                )
                              })}
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
