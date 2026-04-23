import {
  BarChart3,
  BriefcaseBusiness,
  DollarSign,
  FileStack,
  LayoutDashboard,
  ShieldCheck,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

import type { Company } from '../types'

type ShellLayoutProps = {
  children: ReactNode
  companies: Company[]
  selectedCompanyId: number | null
  onSelectCompany: (companyId: number | null) => void
}

const navigation = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/finance', label: 'Finance', icon: DollarSign },
  { to: '/contractors', label: 'Contractors', icon: BriefcaseBusiness },
  { to: '/employees', label: 'Workforce', icon: Users },
  { to: '/training', label: 'Training Hub', icon: FileStack },
  { to: '/certifications', label: 'Evidence', icon: ShieldCheck },
  { to: '/reports', label: 'Report Studio', icon: BarChart3 },
]

export function ShellLayout({
  children,
  companies,
  selectedCompanyId,
  onSelectCompany,
}: ShellLayoutProps) {
  const singleCompany = companies.length === 1 ? companies[0] : null

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
          <p className="eyebrow">What this app does well</p>
          <p>
            Keeps the Cordillera project organized, divides contractors with their own workers,
            tracks contractor budget use against the project cap, and turns raw project records
            and source evidence into usable charts without needing Excel.
          </p>
        </div>
      </aside>

      <main className="main-stage">
        <header className="topbar surface">
          <div>
            <p className="eyebrow">Project control center</p>
            <h2>Track contractors, workforce readiness, training evidence, and certifications</h2>
          </div>

          {singleCompany ? (
            <div className="topbar-fixed-scope">
              <span className="scope-label">Project</span>
              <strong>{singleCompany.name}</strong>
            </div>
          ) : (
            <div className="topbar-actions">
              <label className="field">
                <span>Project scope</span>
                <select
                  value={selectedCompanyId ?? ''}
                  onChange={(event) =>
                    onSelectCompany(event.target.value ? Number(event.target.value) : null)
                  }
                >
                  <option value="">All projects</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </header>

        <div className="page-content">{children}</div>
      </main>
    </div>
  )
}
