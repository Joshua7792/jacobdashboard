// Four-card row at the top of the Overview page: workers, compliance %,
// action count, and expiring-soon count. Tone (good/warn/bad) reacts to the
// numbers so the eye is drawn to anything needing attention.
import { AlertTriangle, Clock, ShieldCheck, Users } from 'lucide-react'
import type { ReactNode } from 'react'

import type { ExcelKPIs } from '../types'

type KPICardProps = {
  icon: ReactNode
  label: string
  value: number | string
  sub: string
  tone?: 'tone-good' | 'tone-warn' | 'tone-bad'
}

function KPICard({ icon, label, value, sub, tone }: KPICardProps) {
  return (
    <article className={`excel-kpi-card surface ${tone ?? ''}`}>
      <div className="excel-kpi-icon">{icon}</div>
      <p className="eyebrow">{label}</p>
      <strong className="excel-kpi-value">{value}</strong>
      <p className="excel-kpi-sub">{sub}</p>
    </article>
  )
}

export function KPIStrip({ kpis }: { kpis: ExcelKPIs }) {
  const compliancePct = kpis.overall_compliance_pct
  const complianceTone =
    compliancePct >= 90 ? 'tone-good' : compliancePct >= 70 ? 'tone-warn' : 'tone-bad'

  return (
    <section className="excel-kpi-grid">
      <KPICard
        icon={<Users size={20} />}
        label="Active workers"
        value={kpis.active_workers}
        sub={`${kpis.total_workers} total · ${kpis.total_contractors} contractors`}
      />
      <KPICard
        icon={<ShieldCheck size={20} />}
        label="Overall compliance"
        value={`${compliancePct.toFixed(1)}%`}
        sub={`${kpis.green_count} current of ${kpis.green_count + kpis.yellow_count + kpis.red_count} dated certs`}
        tone={complianceTone}
      />
      <KPICard
        icon={<AlertTriangle size={20} />}
        label="Needs action"
        value={kpis.red_count}
        sub="Urgent or overdue"
        tone={kpis.red_count > 0 ? 'tone-bad' : 'tone-good'}
      />
      <KPICard
        icon={<Clock size={20} />}
        label="Expiring soon (31-60d)"
        value={kpis.yellow_count}
        sub="Plan ahead"
        tone={kpis.yellow_count > 0 ? 'tone-warn' : 'tone-good'}
      />
    </section>
  )
}
