// Contractors page — one scorecard per contractor.
//
// Each card carries the contractor's compliance %, a stacked status bar,
// the count of workers, and the cert most often missing/red ("weakest cert"
// — computed by the backend). Sort options surface the worst performers
// first when the user wants to triage.
import { Mail, Phone, TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PageShell } from '../components/PageShell'
import { StatusStackedBar } from '../components/StatusPill'
import { useDashboard } from '../context/DashboardContext'

type SortMode = 'compliance-asc' | 'compliance-desc' | 'workers-desc' | 'name'

export function ContractorsPage() {
  const { t } = useTranslation()
  const { data } = useDashboard()
  const [sort, setSort] = useState<SortMode>('compliance-asc')
  const contractors = data?.contractors ?? []

  const sorted = useMemo(() => {
    const copy = [...contractors]
    switch (sort) {
      case 'compliance-asc':
        copy.sort((a, b) => a.compliance_pct - b.compliance_pct)
        break
      case 'compliance-desc':
        copy.sort((a, b) => b.compliance_pct - a.compliance_pct)
        break
      case 'workers-desc':
        copy.sort((a, b) => b.worker_count - a.worker_count)
        break
      case 'name':
        copy.sort((a, b) => a.name.localeCompare(b.name))
        break
    }
    return copy
  }, [contractors, sort])

  return (
    <PageShell
      eyebrow={t('contractors.eyebrow')}
      title={t('contractors.title')}
      description={t('contractors.description')}
      actions={
        <select
          aria-label={t('filter.sort_contractors')}
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
        >
          <option value="compliance-asc">{t('contractors.sort_compliance_asc')}</option>
          <option value="compliance-desc">{t('contractors.sort_compliance_desc')}</option>
          <option value="workers-desc">{t('contractors.sort_workers_desc')}</option>
          <option value="name">{t('contractors.sort_name')}</option>
        </select>
      }
    >
      {sorted.length === 0 ? (
        <p className="excel-empty">{t('contractors.empty')}</p>
      ) : (
        <div className="contractor-grid">
          {sorted.map((c) => {
            const tone =
              c.compliance_pct >= 90
                ? 'tone-good'
                : c.compliance_pct >= 70
                ? 'tone-warn'
                : 'tone-bad'
            const Icon = c.compliance_pct >= 70 ? TrendingUp : TrendingDown
            return (
              <article key={c.name} className={`surface contractor-card ${tone}`}>
                <header className="contractor-card-head">
                  <div>
                    <p className="eyebrow">{c.specialty ?? t('contractors.default_specialty')}</p>
                    <h3>{c.name}</h3>
                  </div>
                  {/* <div className="contractor-card-pct">
                    <Icon size={14} />
                    <span>{c.compliance_pct.toFixed(1)}%</span>
                  </div> */}
                </header>

                <div className="contractor-card-counts">
                  <div>
                    <span className="eyebrow">{t('contractors.card_workers')}</span>
                    <strong>{c.worker_count}</strong>
                  </div>
                  <div>
                    <span className="eyebrow">{t('contractors.card_current')}</span>
                    <strong className="tone-good-text">{c.green_count}</strong>
                  </div>
                  <div>
                    <span className="eyebrow">{t('contractors.card_soon')}</span>
                    <strong className="tone-warn-text">{c.yellow_count}</strong>
                  </div>
                  <div>
                    <span className="eyebrow">{t('contractors.card_urgent')}</span>
                    <strong className="tone-bad-text">{c.red_count}</strong>
                  </div>
                </div>

                <StatusStackedBar
                  green={c.green_count}
                  yellow={c.yellow_count}
                  red={c.red_count}
                  blank={c.blank_count}
                  showLabels
                />

                <div className="contractor-card-footer">
                  {c.weakest_cert && (
                    <p className="contractor-weakest">
                      <span className="eyebrow">{t('contractors.weakest')}</span>
                      <strong>{c.weakest_cert}</strong>
                    </p>
                  )}
                  {c.primary_contact && (
                    <p className="contractor-contact">
                      <Mail size={12} /> {c.primary_contact}
                    </p>
                  )}
                  {c.notes && (
                    <p className="contractor-notes">
                      <Phone size={12} /> {c.notes}
                    </p>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </PageShell>
  )
}
