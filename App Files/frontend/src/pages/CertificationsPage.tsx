// Cert Coverage — stacked-bar chart + table showing how each certification
// breaks down across the workforce.
//
// The chart caps at 12 bars (using the current sort) to stay readable; the
// full list lives below in the table so an auditor can scroll the whole
// catalog. Backend's cert_demand[] is already pre-aggregated; we only sort
// and filter on the client.
import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { PageShell } from '../components/PageShell'
import { StatusStackedBar } from '../components/StatusPill'
import { useDashboard } from '../context/DashboardContext'
import { STATUS_COLOR } from '../lib/format'

type SortMode = 'coverage-asc' | 'coverage-desc' | 'name' | 'urgent-desc'

export function CertificationsPage() {
  const { data } = useDashboard()
  const [sort, setSort] = useState<SortMode>('coverage-asc')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const certs = data?.cert_demand ?? []

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

  // Build chart data: top 12 by current sort, so the chart stays readable.
  const chartData = sorted.slice(0, 12).map((c) => ({
    name: c.cert_name.length > 28 ? c.cert_name.slice(0, 26) + '…' : c.cert_name,
    Current: c.green,
    'Renew soon': c.yellow,
    Urgent: c.red,
    Missing: c.blank,
  }))

  return (
    <PageShell
      eyebrow="Certification coverage"
      title="Where every cert stands across the workforce"
      description="Stacked bars show how each cert breaks down across all workers in the workbook. Use the sort to surface coverage gaps."
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
            <option value="coverage-asc">Lowest coverage first</option>
            <option value="coverage-desc">Highest coverage first</option>
            <option value="urgent-desc">Most urgent</option>
            <option value="name">Name (A–Z)</option>
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
                <p className="eyebrow">Top 12 by current sort</p>
                <h3>Stacked status by certification</h3>
              </div>
            </header>
            <div className="cert-chart-wrap">
              <ResponsiveContainer width="100%" height={420}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                >
                  <CartesianGrid horizontal={false} stroke="rgba(148,163,184,0.18)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    width={170}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid rgba(148,163,184,0.3)',
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Current" stackId="a" fill={STATUS_COLOR.green}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={STATUS_COLOR.green} />
                    ))}
                  </Bar>
                  <Bar dataKey="Renew soon" stackId="a" fill={STATUS_COLOR.yellow} />
                  <Bar dataKey="Urgent" stackId="a" fill={STATUS_COLOR.red} />
                  <Bar dataKey="Missing" stackId="a" fill={STATUS_COLOR.blank} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="surface card-padded">
            <header className="excel-section-head">
              <div>
                <p className="eyebrow">Full list</p>
                <h3>{sorted.length} certifications</h3>
              </div>
            </header>
            <table className="cert-table">
              <thead>
                <tr>
                  <th>Certification</th>
                  <th>Category</th>
                  <th>Status mix</th>
                  <th className="tone-good-text">Current</th>
                  <th className="tone-warn-text">Soon</th>
                  <th className="tone-bad-text">Urgent</th>
                  <th>Missing</th>
                  <th>Coverage</th>
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
