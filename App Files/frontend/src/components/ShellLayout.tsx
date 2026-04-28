// App chrome: dark sidebar with nav + at-a-glance stats, content area on the right.
// Every page renders inside <main>, so this component is the constant frame.
import {
  AlertTriangle,
  BriefcaseBusiness,
  Grid3x3,
  LayoutDashboard,
  ShieldCheck,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

import { useDashboard } from '../context/DashboardContext'

type ShellLayoutProps = {
  children: ReactNode
}

const navigation = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/actions', label: 'Action Center', icon: AlertTriangle },
  { to: '/contractors', label: 'Contractors', icon: BriefcaseBusiness },
  { to: '/workers', label: 'Workforce', icon: Users },
  { to: '/certifications', label: 'Cert Coverage', icon: ShieldCheck },
  { to: '/heatmap', label: 'Heatmap', icon: Grid3x3 },
]

export function ShellLayout({ children }: ShellLayoutProps) {
  const { data } = useDashboard()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-panel">
          <div className="brand-mark">CO</div>
          <div>
            <p className="eyebrow">Cordillera local workforce system</p>
            <h1>Cordillera Control</h1>
          </div>
        </div>

        <nav className="nav-list">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {data && (
          <div className="sidebar-stats surface">
            <p className="eyebrow">At a glance</p>
            <div className="sidebar-stat-row">
              <span>Workers</span>
              <strong>{data.kpis.active_workers}</strong>
            </div>
            <div className="sidebar-stat-row">
              <span>Contractors</span>
              <strong>{data.kpis.total_contractors}</strong>
            </div>
            <div className="sidebar-stat-row">
              <span>Compliance</span>
              <strong>{data.kpis.overall_compliance_pct.toFixed(1)}%</strong>
            </div>
            <div className="sidebar-stat-row">
              <span>Urgent</span>
              <strong className={data.kpis.red_count > 0 ? 'tone-bad-text' : ''}>
                {data.kpis.red_count}
              </strong>
            </div>
          </div>
        )}

        <div className="sidebar-note surface">
          <p className="eyebrow">How it works</p>
          <p>
            Edit the workbook in Excel, save, then click Refresh on any page. The app reads the
            workbook directly — no separate database.
          </p>
        </div>
      </aside>

      <main className="main-stage">
        <div className="page-content">{children}</div>
      </main>
    </div>
  )
}
