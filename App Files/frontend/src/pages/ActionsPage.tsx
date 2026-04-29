// Action Center — every cert that's already red or yellow, with filters.
//
// Backend serves action_list pre-sorted by abs(days_until_anniversary) so
// recent transitions surface first. We layer five UI filters on top:
//   - free-text search across worker + cert name
//   - contractor select
//   - worker status select (active / inactive / onboarding / all)
//   - cert status select (all / overdue / urgent / renew soon)
//   - days-until-anniversary chip set (any / past due / ≤7d / ≤30d / ≤60d)
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PageShell } from '../components/PageShell'
import { StatusPill } from '../components/StatusPill'
import { useDashboard } from '../context/DashboardContext'
import { formatDate, relativeDays, visualStatus } from '../lib/format'
import type { ExcelVisualStatus } from '../types'

type StatusFilter = 'all' | Extract<ExcelVisualStatus, 'yellow' | 'orange' | 'red'>
type WorkerStatusFilter = 'active' | 'inactive' | 'onboarding' | 'all'
type DaysBucket = 'all' | 'past' | 'le7' | 'le30' | 'le60'
const ACTION_ROWS_PER_PAGE = 15

function isActiveWorkerStatus(status: string | undefined) {
  const normalized = (status ?? 'active').toLowerCase()
  return normalized === 'active'
}

function workerStatusLabel(status: string | undefined, t: ReturnType<typeof useTranslation>['t']) {
  const normalized = (status ?? 'active').toLowerCase()
  if (normalized === 'active') return t('actions.worker_status_active')
  if (normalized === 'onboarding') return t('actions.worker_status_onboarding')
  if (normalized === 'inactive') return t('actions.worker_status_inactive')
  return status ?? t('actions.worker_status_active')
}

export function ActionsPage() {
  const { t, i18n } = useTranslation()
  const { data } = useDashboard()
  const [contractorFilter, setContractorFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [workerStatusFilter, setWorkerStatusFilter] = useState<WorkerStatusFilter>('active')
  const [daysBucket, setDaysBucket] = useState<DaysBucket>('all')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

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
        !workerStatusLabel(i.worker_status, t).toLowerCase().includes(q)
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
  }, [scopedItems, contractorFilter, statusFilter, daysBucket, search, t])

  const overdueCount = filtered.filter(
    (i) => visualStatus(i.status, i.days_until_anniversary) === 'red',
  ).length
  const urgentCount = filtered.filter(
    (i) => visualStatus(i.status, i.days_until_anniversary) === 'orange',
  ).length
  const yellowCount = filtered.filter(
    (i) => visualStatus(i.status, i.days_until_anniversary) === 'yellow',
  ).length
  const currentPageCount = Math.max(1, Math.ceil(filtered.length / ACTION_ROWS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, currentPageCount)
  const paged = filtered.slice(
    (safeCurrentPage - 1) * ACTION_ROWS_PER_PAGE,
    safeCurrentPage * ACTION_ROWS_PER_PAGE,
  )

  return (
    <PageShell
      eyebrow={t('actions.eyebrow')}
      title={t('actions.title')}
      description={t('actions.description')}
    >
      <section className="surface card-padded">
        <div className="action-summary-row">
          <div className="action-summary-item">
            <p className="eyebrow">{t('actions.showing')}</p>
            <strong>
              {t('actions.showing_value', { filtered: filtered.length, total: scopedItems.length })}
            </strong>
          </div>
          <div className="action-summary-item">
            <p className="eyebrow">{t('status.overdue')}</p>
            <strong className="tone-bad-text">{overdueCount}</strong>
          </div>
          <div className="action-summary-item">
            <p className="eyebrow">{t('status.urgent')}</p>
            <strong className="tone-urgent-text">{urgentCount}</strong>
          </div>
          <div className="action-summary-item">
            <p className="eyebrow">{t('status.renew_soon')}</p>
            <strong className="tone-warn-text">{yellowCount}</strong>
          </div>
        </div>

        <div className="action-filter-bar">
          <label className="search-field">
            <Search size={14} />
            <input
              type="search"
              placeholder={t('actions.search_placeholder')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setCurrentPage(1)
              }}
            />
          </label>
          <select
            aria-label={t('filter.by_contractor')}
            value={contractorFilter}
            onChange={(e) => {
              setContractorFilter(e.target.value)
              setCurrentPage(1)
            }}
          >
            <option value="all">{t('actions.filter_contractor_all')}</option>
            {contractors.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            aria-label={t('filter.by_worker_status')}
            value={workerStatusFilter}
            onChange={(e) => {
              setWorkerStatusFilter(e.target.value as WorkerStatusFilter)
              setCurrentPage(1)
            }}
          >
            <option value="active">{t('actions.filter_worker_status_active')}</option>
            <option value="inactive">{t('actions.filter_worker_status_inactive')}</option>
            <option value="onboarding">{t('actions.filter_worker_status_onboarding')}</option>
            <option value="all">{t('actions.filter_worker_status_all')}</option>
          </select>
          <select
            aria-label={t('filter.by_cert_status')}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StatusFilter)
              setCurrentPage(1)
            }}
          >
            <option value="all">{t('actions.filter_status_all')}</option>
            <option value="red">{t('actions.filter_status_red')}</option>
            <option value="orange">{t('actions.filter_status_orange')}</option>
            <option value="yellow">{t('actions.filter_status_yellow')}</option>
          </select>
          <div className="filter-chips">
            {(
              [
                ['all', t('actions.filter_days_any')],
                ['past', t('actions.filter_days_past')],
                ['le7', t('actions.filter_days_le7')],
                ['le30', t('actions.filter_days_le30')],
                ['le60', t('actions.filter_days_le60')],
              ] as [DaysBucket, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`chip ${daysBucket === key ? 'chip-active' : ''}`}
                onClick={() => {
                  setDaysBucket(key)
                  setCurrentPage(1)
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="excel-empty">{t('actions.empty')}</p>
        ) : (
          <div className="excel-action-table-wrap">
            <table className="excel-action-table">
              <thead>
                <tr>
                  <th>{t('actions.col_status')}</th>
                  <th>{t('actions.col_worker')}</th>
                  <th>{t('actions.col_contractor')}</th>
                  <th>{t('actions.col_cert')}</th>
                  <th>{t('actions.col_completed')}</th>
                  <th>{t('actions.col_anniversary')}</th>
                  <th>{t('actions.col_days')}</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((item, idx) => (
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
                        {workerStatusLabel(item.worker_status, t)}
                      </span>
                    </td>
                    <td className="excel-action-contractor">{item.contractor}</td>
                    <td>
                      <span className="excel-action-cert">{item.cert_name}</span>
                      <span className="excel-action-category">{item.cert_category}</span>
                    </td>
                    <td>{formatDate(item.completed_on, i18n.language)}</td>
                    <td>{formatDate(item.anniversary, i18n.language)}</td>
                    <td className="excel-action-days">
                      {relativeDays(item.days_until_anniversary, t)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {currentPageCount > 1 && (
              <div className="table-pagination" aria-label={t('pagination.label')}>
                {Array.from({ length: currentPageCount }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    className={`pagination-button ${
                      safeCurrentPage === page ? 'pagination-button-active' : ''
                    }`}
                    onClick={() => setCurrentPage(page)}
                    aria-current={safeCurrentPage === page ? 'page' : undefined}
                  >
                    {page}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </PageShell>
  )
}
