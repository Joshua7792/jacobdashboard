// Cert Coverage — current-cert table + full coverage table.
//
// The top section mirrors the Action Center table, but it shows only current
// certifications. The full list below still uses backend's pre-aggregated
// cert_demand[] so an auditor can scroll the whole catalog.
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PageShell } from '../components/PageShell'
import { StatusPill, StatusStackedBar } from '../components/StatusPill'
import { useDashboard } from '../context/DashboardContext'
import { formatDate, relativeDays } from '../lib/format'

type SortMode = 'coverage-asc' | 'coverage-desc' | 'name' | 'urgent-desc'
type WorkerStatusFilter = 'active' | 'inactive' | 'onboarding' | 'all'
const CURRENT_ROWS_PER_PAGE = 15

type CurrentCertRow = {
  contractor: string
  worker: string
  worker_status: string
  cert_name: string
  cert_category: string
  completed_on: string | null
  anniversary: string | null
  days_until_anniversary: number | null
}

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

export function CertificationsPage() {
  const { t, i18n } = useTranslation()
  const { data } = useDashboard()
  const [sort, setSort] = useState<SortMode>('coverage-asc')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [contractorFilter, setContractorFilter] = useState('all')
  const [workerStatusFilter, setWorkerStatusFilter] = useState<WorkerStatusFilter>('active')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const certs = data?.cert_demand ?? []
  const currentRows = useMemo<CurrentCertRow[]>(
    () =>
      (data?.workers ?? []).flatMap((worker) =>
        worker.certs
          .filter((cert) => cert.status === 'green')
          .map((cert) => ({
            contractor: worker.contractor,
            worker: worker.name,
            worker_status: worker.status,
            cert_name: cert.cert_name,
            cert_category: cert.cert_category,
            completed_on: cert.completed_on,
            anniversary: cert.anniversary,
            days_until_anniversary: cert.days_until_anniversary,
          })),
      ),
    [data?.workers],
  )

  const scopedCurrentRows = useMemo(
    () =>
      workerStatusFilter === 'all'
        ? currentRows
        : currentRows.filter(
            (row) => (row.worker_status ?? 'active').toLowerCase() === workerStatusFilter,
          ),
    [currentRows, workerStatusFilter],
  )

  const currentContractors = useMemo(
    () => Array.from(new Set(scopedCurrentRows.map((row) => row.contractor))).sort(),
    [scopedCurrentRows],
  )

  const filteredCurrentRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return scopedCurrentRows.filter((row) => {
      if (contractorFilter !== 'all' && row.contractor !== contractorFilter) return false
      if (
        q &&
        !row.worker.toLowerCase().includes(q) &&
        !row.cert_name.toLowerCase().includes(q) &&
        !workerStatusLabel(row.worker_status, t).toLowerCase().includes(q)
      ) {
        return false
      }
      return true
    })
  }, [scopedCurrentRows, contractorFilter, search, t])

  const filteredCurrentWorkers = useMemo(
    () => new Set(filteredCurrentRows.map((row) => row.worker)).size,
    [filteredCurrentRows],
  )
  const filteredCurrentContractors = useMemo(
    () => new Set(filteredCurrentRows.map((row) => row.contractor)).size,
    [filteredCurrentRows],
  )
  const currentPageCount = Math.max(
    1,
    Math.ceil(filteredCurrentRows.length / CURRENT_ROWS_PER_PAGE),
  )
  const safeCurrentPage = Math.min(currentPage, currentPageCount)
  const pagedCurrentRows = filteredCurrentRows.slice(
    (safeCurrentPage - 1) * CURRENT_ROWS_PER_PAGE,
    safeCurrentPage * CURRENT_ROWS_PER_PAGE,
  )

  const categories = useMemo(
    () => Array.from(new Set(certs.map((c) => c.cert_category))).sort(),
    [certs],
  )

  const sorted = useMemo(() => {
    let list = certs
    if (categoryFilter !== 'all') {
      list = list.filter((c) => c.cert_category === categoryFilter)
    }
    const copy = [...list]
    switch (sort) {
      case 'coverage-asc':
        copy.sort((a, b) => a.coverage_pct - b.coverage_pct)
        break
      case 'coverage-desc':
        copy.sort((a, b) => b.coverage_pct - a.coverage_pct)
        break
      case 'urgent-desc':
        copy.sort((a, b) => b.red - a.red)
        break
      case 'name':
        copy.sort((a, b) => a.cert_name.localeCompare(b.cert_name))
        break
    }
    return copy
  }, [certs, sort, categoryFilter])

  return (
    <PageShell
      eyebrow={t('certifications.eyebrow')}
      title={t('certifications.title')}
      description={t('certifications.description')}
      actions={
        <>
          <select
            aria-label={t('filter.by_category')}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">{t('certifications.filter_category_all')}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            aria-label={t('filter.sort_certs')}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
          >
            <option value="coverage-asc">{t('certifications.sort_coverage_asc')}</option>
            <option value="coverage-desc">{t('certifications.sort_coverage_desc')}</option>
            <option value="urgent-desc">{t('certifications.sort_urgent_desc')}</option>
            <option value="name">{t('certifications.sort_name')}</option>
          </select>
        </>
      }
    >
      {sorted.length === 0 ? (
        <p className="excel-empty">{t('certifications.empty')}</p>
      ) : (
        <>
          <section className="surface card-padded">
            <header className="excel-section-head">
              <div>
                <p className="eyebrow">{t('certifications.current_eyebrow')}</p>
                <h3>{t('certifications.current_title')}</h3>
              </div>
            </header>

            <div className="action-summary-row">
              <div className="action-summary-item">
                <p className="eyebrow">{t('actions.showing')}</p>
                <strong>
                  {t('actions.showing_value', {
                    filtered: filteredCurrentRows.length,
                    total: scopedCurrentRows.length,
                  })}
                </strong>
              </div>
              <div className="action-summary-item">
                <p className="eyebrow">{t('status.current')}</p>
                <strong className="tone-good-text">{filteredCurrentRows.length}</strong>
              </div>
              <div className="action-summary-item">
                <p className="eyebrow">{t('app.stat_workers')}</p>
                <strong>{filteredCurrentWorkers}</strong>
              </div>
              <div className="action-summary-item">
                <p className="eyebrow">{t('app.stat_contractors')}</p>
                <strong>{filteredCurrentContractors}</strong>
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
                {currentContractors.map((contractor) => (
                  <option key={contractor} value={contractor}>
                    {contractor}
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
            </div>

            {filteredCurrentRows.length === 0 ? (
              <p className="excel-empty">{t('certifications.current_empty')}</p>
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
                    {pagedCurrentRows.map((item, idx) => (
                      <tr key={`${item.worker}-${item.cert_name}-${idx}`}>
                        <td>
                          <StatusPill status="green" />
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

          <section className="surface card-padded">
            <header className="excel-section-head">
              <div>
                <p className="eyebrow">{t('certifications.list_eyebrow')}</p>
                <h3>{t('certifications.list_title', { count: sorted.length })}</h3>
              </div>
            </header>
            <table className="cert-table">
              <thead>
                <tr>
                  <th>{t('certifications.col_cert')}</th>
                  <th>{t('certifications.col_category')}</th>
                  <th>{t('certifications.col_status_mix')}</th>
                  <th className="tone-good-text">{t('certifications.col_current')}</th>
                  <th className="tone-warn-text">{t('certifications.col_soon')}</th>
                  <th className="tone-bad-text">{t('certifications.col_urgent')}</th>
                  <th>{t('certifications.col_missing')}</th>
                  <th>{t('certifications.col_coverage')}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((c) => (
                  <tr key={c.cert_name}>
                    <td>
                      <strong>{c.cert_name}</strong>
                    </td>
                    <td className="cert-table-category">{c.cert_category}</td>
                    <td className="cert-table-bar">
                      <StatusStackedBar
                        green={c.green}
                        yellow={c.yellow}
                        red={c.red}
                        blank={c.blank}
                      />
                    </td>
                    <td>{c.green}</td>
                    <td>{c.yellow}</td>
                    <td>{c.red}</td>
                    <td>{c.blank}</td>
                    <td>
                      <strong>{c.coverage_pct.toFixed(0)}%</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </PageShell>
  )
}
