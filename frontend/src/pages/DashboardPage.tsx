import { AlertTriangle, ClipboardList, FileStack, Users2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { api } from '../api'
import { formatDate } from '../lib/compliance'
import type { DashboardOverview } from '../types'

type DashboardPageProps = {
  selectedCompanyId: number | null
}

export function DashboardPage({ selectedCompanyId }: DashboardPageProps) {
  const [data, setData] = useState<DashboardOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadOverview() {
      try {
        if (data) {
          setRefreshing(true)
        } else {
          setLoading(true)
        }
        setError(null)
        const overview = await api.getDashboardOverview(selectedCompanyId)
        if (active) {
          setData(overview)
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load dashboard')
        }
      } finally {
        if (active) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    }

    loadOverview()

    return () => {
      active = false
    }
  }, [selectedCompanyId])

  if (loading && !data) {
    return (
      <section className="surface page-grid">
        <div className="loading">Loading dashboard...</div>
      </section>
    )
  }

  if (error || !data) {
    return (
      <section className="surface page-grid">
        <div className="error-banner">{error || 'Dashboard data is unavailable.'}</div>
      </section>
    )
  }

  return (
    <section className="page-grid">
      {refreshing && <div className="info-banner">Refreshing dashboard data...</div>}

      <div className="hero-panel surface">
        <div>
          <p className="eyebrow">Project scope</p>
          <h3>{data.company_scope}</h3>
          <p className="hero-copy">
            A live operations view of the Cordillera workforce, contractor compliance, imported
            training evidence, and the items still missing before audit time.
          </p>
        </div>
        <div className="hero-icons">
          <span>
            <Users2 size={20} /> Workforce
          </span>
          <span>
            <ClipboardList size={20} /> Compliance
          </span>
          <span>
            <FileStack size={20} /> Evidence
          </span>
          <span>
            <AlertTriangle size={20} /> Audit gaps
          </span>
        </div>
      </div>

      <div className="stats-grid">
        {data.metrics.map((metric) => (
          <article key={metric.label} className="surface stat-card">
            <p className="eyebrow">{metric.label}</p>
            <strong>{metric.value}</strong>
            {metric.sub_label && <p className="muted-copy">{metric.sub_label}</p>}
          </article>
        ))}
      </div>

      <div className="page-grid two-column">
        <article className="surface chart-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Contractors</p>
              <h3>Compliance by contractor</h3>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.contractor_compliance}>
              <CartesianGrid strokeDasharray="4 4" stroke="#dbe4ff" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#1d4ed8" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </article>

        <article className="surface chart-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Coverage</p>
              <h3>Most completed trainings</h3>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.training_coverage}>
              <CartesianGrid strokeDasharray="4 4" stroke="#dbe4ff" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#0f766e" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </article>
      </div>

      <div className="page-grid two-column">
        <article className="surface list-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Recent evidence</p>
              <h3>Imported contractor files</h3>
            </div>
          </div>
          <div className="list-stack">
            {data.recent_imports.length === 0 && (
              <p className="empty-copy">No source documents have been imported yet.</p>
            )}
            {data.recent_imports.map((document) => (
              <div key={document.id} className="list-row">
                <div>
                  <strong>{document.original_file_name || document.title}</strong>
                  <p>
                    {document.contractor_name} • {document.training_count} linked records •{' '}
                    {formatDate(document.completed_on)}
                  </p>
                </div>
                {document.file_url && (
                  <a className="ghost-button" href={document.file_url} target="_blank" rel="noreferrer">
                    Open
                  </a>
                )}
              </div>
            ))}
          </div>
        </article>

        <article className="surface list-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Workforce snapshot</p>
              <h3>Recently added workers</h3>
            </div>
          </div>
          <div className="list-stack">
            {data.recent_workers.map((worker) => (
              <div key={worker.id} className="list-row">
                <div>
                  <strong>{worker.full_name}</strong>
                  <p>
                    {worker.contractor_name || 'Unassigned'} • {worker.trainings_completed}/
                    {worker.trainings_required} completed
                  </p>
                </div>
                <span className={`badge badge-${worker.compliance_status === 'complete' ? 'valid' : worker.compliance_status === 'partial' ? 'expiring' : 'missing'}`}>
                  {worker.compliance_pct}% ready
                </span>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  )
}
