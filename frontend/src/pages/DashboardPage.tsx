import { AlertTriangle, Clock3, Users2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { api } from '../api'
import type { DashboardOverview } from '../types'

type DashboardPageProps = {
  selectedCompanyId: number | null
}

const healthColors = ['#0ea5e9', '#f59e0b', '#ef4444', '#a855f7']
const contractorColors = ['#1d4ed8', '#0f766e', '#be123c', '#b45309', '#7c3aed', '#0f766e']

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
    return <section className="surface page-grid"><div className="loading">Loading dashboard...</div></section>
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
          <p className="eyebrow">Current scope</p>
          <h3>{data.company_scope}</h3>
          <p className="hero-copy">
            A live view of employees, onboarding momentum, contractor coverage, and certification
            pressure so you can spot what needs attention fast.
          </p>
        </div>
        <div className="hero-icons">
          <span><Users2 size={20} /> Crew visibility</span>
          <span><Clock3 size={20} /> Expiration watch</span>
          <span><AlertTriangle size={20} /> Issue radar</span>
        </div>
      </div>

      <div className="stats-grid">
        {data.metrics.map((metric) => (
          <article key={metric.label} className="surface stat-card">
            <p className="eyebrow">{metric.label}</p>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </div>

      <article className="surface chart-card chart-card-wide">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Trend</p>
            <h3>Employee onboarding flow</h3>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data.onboarding_trend}>
            <defs>
              <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="#dbe4ff" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
            <Tooltip />
            <Area type="monotone" dataKey="value" stroke="#1d4ed8" fill="url(#growthFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </article>

      <article className="surface chart-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Contractors</p>
            <h3>Certification mix</h3>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data.contractor_distribution}
              dataKey="value"
              nameKey="label"
              innerRadius={55}
              outerRadius={95}
              paddingAngle={3}
            >
              {data.contractor_distribution.map((entry, index) => (
                <Cell key={entry.label} fill={contractorColors[index % contractorColors.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="legend-list">
          {data.contractor_distribution.map((entry, index) => (
            <div key={entry.label} className="legend-item">
              <span
                className="legend-swatch"
                style={{ backgroundColor: contractorColors[index % contractorColors.length] }}
              />
              <span>{entry.label}</span>
              <strong>{entry.value}</strong>
            </div>
          ))}
        </div>
      </article>

      <article className="surface chart-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Health</p>
            <h3>Certification status</h3>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.certification_health}>
            <CartesianGrid strokeDasharray="4 4" stroke="#dbe4ff" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
            <Tooltip />
            <Bar dataKey="value" radius={[10, 10, 0, 0]}>
              {data.certification_health.map((entry, index) => (
                <Cell key={entry.label} fill={healthColors[index % healthColors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </article>

      <article className="surface list-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Action queue</p>
            <h3>Expiring certifications</h3>
          </div>
        </div>
        <div className="list-stack">
          {data.expiring_certifications.length === 0 && (
            <p className="empty-copy">Nothing is expiring in the next 30 days.</p>
          )}
          {data.expiring_certifications.map((certification) => (
            <div key={certification.id} className="list-row">
              <div>
                <strong>{certification.title}</strong>
                <p>
                  {certification.worker_name} • {certification.company_name}
                </p>
              </div>
              <span className="badge badge-warning">
                {certification.expiration_date || 'No expiration'}
              </span>
            </div>
          ))}
        </div>
      </article>

      <article className="surface list-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Recent activity</p>
            <h3>Newest employees</h3>
          </div>
        </div>
        <div className="list-stack">
          {data.recent_workers.map((worker) => (
            <div key={worker.id} className="list-row">
              <div>
                <strong>{worker.full_name}</strong>
                <p>
                  {worker.contractor_name || 'Unassigned'} • {worker.job_title || 'No role'}
                </p>
              </div>
              <span className={`badge badge-${worker.certification_status}`}>
                {worker.certification_status}
              </span>
            </div>
          ))}
        </div>
      </article>
    </section>
  )
}
