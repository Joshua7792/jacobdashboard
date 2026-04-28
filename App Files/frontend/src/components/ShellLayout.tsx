import { LayoutDashboard } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

type ShellLayoutProps = {
  children: ReactNode
}

const navigation = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
]

export function ShellLayout({ children }: ShellLayoutProps) {
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
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-note surface">
          <p className="eyebrow">How it works</p>
          <p>
            Edit the workbook in Excel, save, then click Refresh on the dashboard. The app reads
            the workbook directly — no separate database to keep in sync.
          </p>
        </div>
      </aside>

      <main className="main-stage">
        <header className="topbar surface">
          <div>
            <p className="eyebrow">Project control center</p>
            <h2>Contractor certification status, live from the workbook</h2>
          </div>
        </header>

        <div className="page-content">{children}</div>
      </main>
    </div>
  )
}
