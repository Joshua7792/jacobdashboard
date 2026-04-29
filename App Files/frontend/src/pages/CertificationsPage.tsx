// Cert Coverage — priority-first view for deciding which certifications need
// attention next. The page derives overdue/urgent split from the heatmap so
// it matches the red/orange/yellow language used elsewhere in the app.
import { AlertTriangle, ShieldCheck, TrendingDown } from 'lucide-react'
import { useMemo, useState } from 'react'

import { PageShell } from '../components/PageShell'
import { useDashboard } from '../context/DashboardContext'
import { visualStatus } from '../lib/format'

type SortMode = 'priority-desc' | 'coverage-asc' | 'missing-desc' | 'name'

type CertCoverageRow = {
  certName: string
  category: string
  current: number
  renewSoon: number
  urgent: number
  overdue: number
  missing: number
  total: number
  coveragePct: number
  priorityScore: number
  topContractors: { name: string; count: number }[]
}

function pct(part: number, total: number) {
  return total > 0 ? (part / total) * 100 : 0
}

function CoverageStrip({ cert }: { cert: CertCoverageRow }) {
  const segments = [
    ['current', cert.current, '#22c55e', 'Current'],
    ['renew', cert.renewSoon, '#eab308', 'Renew soon'],
    ['urgent', cert.urgent, '#f97316', 'Urgent'],
    ['overdue', cert.overdue, '#ef4444', 'Overdue'],
    ['missing', cert.missing, '#94a3b8', 'Missing'],
  ] as const

  return (
    <div className="cert-priority-strip" aria-label={`${cert.certName} status mix`}>
      {segments.map(([key, value, color, label]) =>
        value > 0 ? (
          <span
            key={key}
            style={{ width: `${pct(value, cert.total)}%`, background: color }}
            title={`${value} ${label.toLowerCase()}`}
          />
        ) : null,
      )}
    </div>
  )
}

function MiniMetric({
  label,
  value,
  tone,
}: {
  label: string
  value: number | string
  tone?: 'good' | 'warn' | 'urgent' | 'bad'
}) {
  return (
    <div className={`cert-mini-metric ${tone ? `tone-${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export function CertificationsPage() {
  const { data } = useDashboard()
  const [sort, setSort] = useState<SortMode>('priority-desc')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const certs = useMemo<CertCoverageRow[]>(() => {
    if (!data) return []

    return data.heatmap.cert_names.map((certName, idx) => {
      const category = data.heatmap.cert_categories[idx]
      const contractorCounts = new Map<string, number>()
      let current = 0
      let renewSoon = 0
      let urgent = 0
      let overdue = 0
      let missing = 0

      data.heatmap.rows.forEach((row) => {
        const cell = row.statuses[idx]
        const status = visualStatus(cell?.status ?? 'blank', cell?.days_until_anniversary ?? null)

        if (status === 'green') current++
        else if (status === 'yellow') renewSoon++
        else if (status === 'orange') urgent++
        else if (status === 'red') overdue++
        else missing++

        if (status === 'orange' || status === 'red' || status === 'blank') {
          contractorCounts.set(row.contractor, (contractorCounts.get(row.contractor) ?? 0) + 1)
        }
      })

      const total = data.heatmap.rows.length
      const topContractors = Array.from(contractorCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .slice(0, 3)

      return {
        certName,
        category,
        current,
        renewSoon,
        urgent,
        overdue,
        missing,
        total,
        coveragePct: pct(current, total),
        priorityScore: overdue * 5 + urgent * 4 + renewSoon * 2 + missing,
        topContractors,
      }
    })
  }, [data])

  const categories = useMemo(
    () => Array.from(new Set(certs.map((c) => c.category))).sort(),
    [certs],
  )

  const sorted = useMemo(() => {
    let list = certs
    if (categoryFilter !== 'all') {
      list = list.filter((c) => c.category === categoryFilter)
    }
    const copy = [...list]
    switch (sort) {
      case 'priority-desc':
        copy.sort((a, b) => b.priorityScore - a.priorityScore)
        break
      case 'coverage-asc':
        copy.sort((a, b) => a.coveragePct - b.coveragePct)
        break
      case 'missing-desc':
        copy.sort((a, b) => b.missing - a.missing)
        break
      case 'name':
        copy.sort((a, b) => a.certName.localeCompare(b.certName))
        break
    }
    return copy
  }, [certs, sort, categoryFilter])

  const priorityCerts = sorted.slice(0, 6)
  const overdueHeavy = [...sorted]
    .filter((c) => c.overdue > 0)
    .sort((a, b) => b.overdue - a.overdue)
    .slice(0, 4)
  const missingHeavy = [...sorted]
    .filter((c) => c.missing > 0)
    .sort((a, b) => b.missing - a.missing)
    .slice(0, 4)
  const healthiest = [...sorted]
    .filter((c) => c.coveragePct > 0)
    .sort((a, b) => b.coveragePct - a.coveragePct)
    .slice(0, 4)

  return (
    <PageShell
      eyebrow="Certification coverage"
      title="Where every cert stands across the workforce"
      description="Priority rows highlight overdue, urgent, missing, and current coverage so the next certification cleanup is easier to pick."
      actions={
        <>
          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            aria-label="Sort certifications"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
          >
            <option value="priority-desc">Highest priority first</option>
            <option value="coverage-asc">Lowest coverage first</option>
            <option value="missing-desc">Most missing first</option>
            <option value="name">Name (A-Z)</option>
          </select>
        </>
      }
    >
      {sorted.length === 0 ? (
        <p className="excel-empty">No cert demand data yet.</p>
      ) : (
        <>
          <section className="surface card-padded">
            <header className="excel-section-head">
              <div>
                <p className="eyebrow">Priority board</p>
                <h3>Certifications to clean up first</h3>
              </div>
            </header>
            <div className="cert-priority-list">
              {priorityCerts.map((cert) => (
                <article key={cert.certName} className="cert-priority-row">
                  <div className="cert-priority-main">
                    <div className="cert-priority-title">
                      <strong>{cert.certName}</strong>
                      <span>{cert.category}</span>
                    </div>
                    <CoverageStrip cert={cert} />
                    <div className="cert-contractor-chips">
                      {cert.topContractors.length > 0 ? (
                        cert.topContractors.map((c) => (
                          <span key={c.name}>
                            {c.name}: {c.count}
                          </span>
                        ))
                      ) : (
                        <span>No contractor gaps</span>
                      )}
                    </div>
                  </div>
                  <div className="cert-priority-metrics">
                    <MiniMetric label="Coverage" value={`${cert.coveragePct.toFixed(0)}%`} tone="good" />
                    <MiniMetric label="Overdue" value={cert.overdue} tone="bad" />
                    <MiniMetric label="Urgent" value={cert.urgent} tone="urgent" />
                    <MiniMetric label="Missing" value={cert.missing} />
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="cert-lane-grid">
            <div className="surface card-padded cert-lane">
              <header>
                <AlertTriangle size={16} />
                <div>
                  <p className="eyebrow">Overdue-heavy</p>
                  <h3>Expired dates</h3>
                </div>
              </header>
              <MiniCertList certs={overdueHeavy} metric="overdue" empty="No overdue certs here." />
            </div>
            <div className="surface card-padded cert-lane">
              <header>
                <TrendingDown size={16} />
                <div>
                  <p className="eyebrow">Missing-heavy</p>
                  <h3>Coverage gaps</h3>
                </div>
              </header>
              <MiniCertList certs={missingHeavy} metric="missing" empty="No missing certs here." />
            </div>
            <div className="surface card-padded cert-lane">
              <header>
                <ShieldCheck size={16} />
                <div>
                  <p className="eyebrow">Healthiest</p>
                  <h3>Best covered</h3>
                </div>
              </header>
              <MiniCertList certs={healthiest} metric="coverage" empty="No covered certs yet." />
            </div>
          </section>

          <section className="surface card-padded">
            <header className="excel-section-head">
              <div>
                <p className="eyebrow">Full certification list</p>
                <h3>{sorted.length} certifications</h3>
              </div>
            </header>
            <div className="table-wrap">
              <table className="cert-table cert-table-modern">
                <thead>
                  <tr>
                    <th>Certification</th>
                    <th>Coverage</th>
                    <th>Status mix</th>
                    <th className="tone-good-text">Current</th>
                    <th className="tone-warn-text">Soon</th>
                    <th className="tone-urgent-text">Urgent</th>
                    <th className="tone-bad-text">Overdue</th>
                    <th>Missing</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((cert) => (
                    <tr key={cert.certName}>
                      <td>
                        <strong>{cert.certName}</strong>
                        <span className="cert-table-category">{cert.category}</span>
                      </td>
                      <td>
                        <strong>{cert.coveragePct.toFixed(0)}%</strong>
                      </td>
                      <td className="cert-table-bar">
                        <CoverageStrip cert={cert} />
                      </td>
                      <td>{cert.current}</td>
                      <td>{cert.renewSoon}</td>
                      <td>{cert.urgent}</td>
                      <td>{cert.overdue}</td>
                      <td>{cert.missing}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </PageShell>
  )
}

function MiniCertList({
  certs,
  metric,
  empty,
}: {
  certs: CertCoverageRow[]
  metric: 'overdue' | 'missing' | 'coverage'
  empty: string
}) {
  if (certs.length === 0) return <p className="empty-copy">{empty}</p>

  return (
    <ul className="cert-mini-list">
      {certs.map((cert) => {
        const value =
          metric === 'coverage'
            ? `${cert.coveragePct.toFixed(0)}%`
            : metric === 'overdue'
            ? cert.overdue
            : cert.missing
        return (
          <li key={cert.certName}>
            <div>
              <strong>{cert.certName}</strong>
              <span>{cert.category}</span>
            </div>
            <strong>{value}</strong>
          </li>
        )
      })}
    </ul>
  )
}
