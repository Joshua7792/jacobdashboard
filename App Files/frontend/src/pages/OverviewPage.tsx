// Overview page — the landing page after navigating to "/".
//
// Compact, audit-ready summary: the four KPI cards, then two side-by-side
// rows that surface (a) where compliance currently sits, (b) which
// contractors and certs need attention. Deep dives live on dedicated pages
// linked via the "See all" arrows so the overview stays scannable.
import { ArrowRight, TrendingDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import { KPIStrip } from '../components/KPIStrip'
import { PageShell } from '../components/PageShell'
import { StatusPill, StatusStackedBar } from '../components/StatusPill'
import { useDashboard } from '../context/DashboardContext'
import { STATUS_COLOR, formatDate, relativeDays, visualStatus } from '../lib/format'

export function OverviewPage() {
  const { t, i18n } = useTranslation()
  const { data } = useDashboard()
  if (!data) return null

  const { kpis, action_list, contractors, cert_demand, issues } = data

  // Donut data: cert status breakdown.
  const donutData = [
    { name: t('status.current'), value: kpis.green_count, key: 'green' as const },
    { name: t('status.renew_soon'), value: kpis.yellow_count, key: 'yellow' as const },
    { name: t('status.urgent'), value: kpis.red_count, key: 'red' as const },
    { name: t('status.missing'), value: kpis.blank_count, key: 'blank' as const },
  ].filter((d) => d.value > 0)
  const donutTotal = donutData.reduce((sum, d) => sum + d.value, 0)

  // Top 5 contractors by compliance, sorted ascending so the lowest is first.
  const weakestContractors = [...contractors]
    .sort((a, b) => a.compliance_pct - b.compliance_pct)
    .slice(0, 5)

  // Top 5 worst-covered certs: lowest coverage_pct first.
  const weakestCerts = [...cert_demand]
    .sort((a, b) => a.coverage_pct - b.coverage_pct)
    .slice(0, 5)

  // Top 5 most urgent action items.
  const topActions = action_list.slice(0, 5)

  return (
    <PageShell
      eyebrow={t('overview.eyebrow')}
      title={t('overview.title')}
      description={t('overview.description')}
    >
      <KPIStrip kpis={kpis} />

      <div className="overview-row-2">
        {/* Compliance donut */}
        <section className="surface card-padded">
          <header className="excel-section-head">
            <div>
              <p className="eyebrow">{t('overview.compliance_eyebrow')}</p>
              <h3>{t('overview.compliance_title')}</h3>
            </div>
          </header>
          {donutTotal === 0 ? (
            <p className="excel-empty">{t('overview.compliance_empty')}</p>
          ) : (
            <div className="overview-donut-wrap">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    innerRadius={56}
                    outerRadius={92}
                    paddingAngle={2}
                  >
                    {donutData.map((d) => (
                      <Cell key={d.key} fill={STATUS_COLOR[d.key]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <ul className="overview-donut-legend">
                {donutData.map((d) => (
                  <li key={d.key}>
                    <span className={`dot dot-${d.key}`} />
                    <span className="legend-label">{d.name}</span>
                    <strong>{d.value}</strong>
                    <span className="legend-pct">
                      {((d.value / donutTotal) * 100).toFixed(1)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Contractor leaderboard */}
        <section className="surface card-padded">
          <header className="excel-section-head">
            <div>
              <p className="eyebrow">{t('overview.leaderboard_eyebrow')}</p>
              <h3>{t('overview.leaderboard_title')}</h3>
            </div>
            <Link to="/contractors" className="link-arrow">
              {t('overview.see_all')} <ArrowRight size={14} />
            </Link>
          </header>
          {weakestContractors.length === 0 ? (
            <p className="excel-empty">{t('overview.leaderboard_empty')}</p>
          ) : (
            <ul className="leaderboard-list">
              {weakestContractors.map((c) => {
                const workersLabel =
                  c.worker_count === 1
                    ? t('overview.leaderboard_workers', { count: c.worker_count })
                    : t('overview.leaderboard_workers_plural', { count: c.worker_count })
                return (
                  <li key={c.name} className="leaderboard-row">
                    <div className="leaderboard-name">
                      <strong>{c.name}</strong>
                      <span>
                        {workersLabel} · {c.weakest_cert ?? '—'}
                      </span>
                    </div>
                    <div className="leaderboard-bar">
                      <StatusStackedBar
                        green={c.green_count}
                        yellow={c.yellow_count}
                        red={c.red_count}
                        blank={c.blank_count}
                      />
                    </div>
                    <strong className="leaderboard-pct">{c.compliance_pct.toFixed(1)}%</strong>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="overview-row-2">
        {/* Top urgent items snapshot */}
        <section className="surface card-padded">
          <header className="excel-section-head">
            <div>
              <p className="eyebrow">{t('overview.actions_eyebrow')}</p>
              <h3>{t('overview.actions_title')}</h3>
            </div>
            <Link to="/actions" className="link-arrow">
              {t('overview.actions_open')} <ArrowRight size={14} />
            </Link>
          </header>
          {topActions.length === 0 ? (
            <p className="excel-empty">{t('overview.actions_empty')}</p>
          ) : (
            <ul className="overview-action-list">
              {topActions.map((item, idx) => (
                <li key={`${item.worker}-${item.cert_name}-${idx}`}>
                  <StatusPill status={visualStatus(item.status, item.days_until_anniversary)} />
                  <div className="overview-action-text">
                    <strong>{item.worker}</strong>
                    <span>{item.contractor}</span>
                    <p>{item.cert_name}</p>
                  </div>
                  <div className="overview-action-meta">
                    <span>{relativeDays(item.days_until_anniversary, t)}</span>
                    <small>{formatDate(item.anniversary, i18n.language)}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Worst-covered certs */}
        <section className="surface card-padded">
          <header className="excel-section-head">
            <div>
              <p className="eyebrow">{t('overview.gaps_eyebrow')}</p>
              <h3>{t('overview.gaps_title')}</h3>
            </div>
            <Link to="/certifications" className="link-arrow">
              {t('overview.see_all')} <ArrowRight size={14} />
            </Link>
          </header>
          {weakestCerts.length === 0 ? (
            <p className="excel-empty">{t('overview.gaps_empty')}</p>
          ) : (
            <ul className="cert-demand-list">
              {weakestCerts.map((c) => (
                <li key={c.cert_name} className="cert-demand-row">
                  <div className="cert-demand-text">
                    <strong>{c.cert_name}</strong>
                    <span>{c.cert_category}</span>
                  </div>
                  <div className="cert-demand-bar">
                    <StatusStackedBar
                      green={c.green}
                      yellow={c.yellow}
                      red={c.red}
                      blank={c.blank}
                    />
                  </div>
                  <strong className="cert-demand-pct">
                    <TrendingDown size={13} /> {c.coverage_pct.toFixed(0)}%
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {issues.length > 0 && (
        <section className="surface excel-issues-card">
          <header>
            <strong>{t('overview.issues_title')}</strong>
          </header>
          <ul>
            {issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </section>
      )}
    </PageShell>
  )
}
