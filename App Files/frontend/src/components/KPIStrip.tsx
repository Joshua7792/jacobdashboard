// Four-card row at the top of the Overview page: workers, compliance %,
// urgent count, and expiring-soon count. Tone (good/warn/bad) reacts to the
// numbers so the eye is drawn to anything red.
import { AlertTriangle, Clock, ShieldCheck, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
  const compliancePct = kpis.overall_compliance_pct
  const complianceTone =
    compliancePct >= 90 ? 'tone-good' : compliancePct >= 70 ? 'tone-warn' : 'tone-bad'

  return (
    <section className="excel-kpi-grid">
      <KPICard
        icon={<Users size={20} />}
        label={t('kpi.active_workers')}
        value={kpis.active_workers}
        sub={t('kpi.active_workers_sub', {
          total: kpis.total_workers,
          contractors: kpis.total_contractors,
        })}
      />
      <KPICard
        icon={<ShieldCheck size={20} />}
        label={t('kpi.compliance')}
        value={`${compliancePct.toFixed(1)}%`}
        sub={t('kpi.compliance_sub', {
          green: kpis.green_count,
          dated: kpis.green_count + kpis.yellow_count + kpis.red_count,
        })}
        tone={complianceTone}
      />
      <KPICard
        icon={<AlertTriangle size={20} />}
        label={t('kpi.urgent')}
        value={kpis.red_count}
        sub={t('kpi.urgent_sub')}
        tone={kpis.red_count > 0 ? 'tone-bad' : 'tone-good'}
      />
      <KPICard
        icon={<Clock size={20} />}
        label={t('kpi.expiring')}
        value={kpis.yellow_count}
        sub={t('kpi.expiring_sub')}
        tone={kpis.yellow_count > 0 ? 'tone-warn' : 'tone-good'}
      />
    </section>
  )
}
