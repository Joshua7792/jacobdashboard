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
import type { ReportPreview } from '../types'

type ReportsPageProps = {
  selectedCompanyId: number | null
}

const groupOptions: Record<string, { value: string; label: string }[]> = {
  workers: [
    { value: 'project', label: 'Project' },
    { value: 'contractor', label: 'Contractor' },
    { value: 'status', label: 'Worker status' },
    { value: 'month', label: 'Hire month' },
    { value: 'compliance', label: 'Compliance status' },
  ],
  trainings: [
    { value: 'contractor', label: 'Contractor' },
    { value: 'status', label: 'Training status' },
    { value: 'category', label: 'Category' },
    { value: 'training', label: 'Training name' },
  ],
}

export function ReportsPage({ selectedCompanyId }: ReportsPageProps) {
  const [dataset, setDataset] = useState<'workers' | 'trainings'>('workers')
  const [groupBy, setGroupBy] = useState('project')
  const [report, setReport] = useState<ReportPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const nextGroup = groupOptions[dataset][0]?.value ?? 'project'
    setGroupBy(nextGroup)
  }, [dataset])

  useEffect(() => {
    async function loadReport() {
      try {
        setLoading(true)
        setError(null)
        const preview = await api.getReportPreview({
          dataset,
          group_by: groupBy,
          company_id: selectedCompanyId,
        })
        setReport(preview)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to build report')
      } finally {
        setLoading(false)
      }
    }

    loadReport()
  }, [dataset, groupBy, selectedCompanyId])

  return (
    <section className="page-grid">
      <article className="surface panel-stack">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Draft builder</p>
            <h3>Create a graph from the data you want</h3>
          </div>
        </div>

        <div className="toolbar">
          <label className="field">
            <span>Dataset</span>
            <select
              value={dataset}
              onChange={(event) => setDataset(event.target.value as 'workers' | 'trainings')}
            >
              <option value="workers">Workers</option>
              <option value="trainings">Trainings</option>
            </select>
          </label>
          <label className="field">
            <span>Group by</span>
            <select value={groupBy} onChange={(event) => setGroupBy(event.target.value)}>
              {groupOptions[dataset].map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && <div className="error-banner">{error}</div>}
        {loading && <div className="loading">Refreshing report preview...</div>}

        {report && (
          <div className="report-grid">
            <div className="chart-card">
              <p className="eyebrow">Preview</p>
              <h3>{report.title}</h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={report.rows}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#dbe4ff" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#1d4ed8" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="surface nested-surface">
              <p className="eyebrow">Table view</p>
              <h3>Numbers behind the chart</h3>
              <div className="list-stack">
                {report.rows.map((row) => (
                  <div key={row.label} className="list-row">
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </article>
    </section>
  )
}
