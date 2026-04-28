// Wrapper used by every page so they share the same header, refresh bar, and
// loading/error states. Pages call <PageShell title="..."> and render their
// content as children — no boilerplate per page.
import { AlertTriangle } from 'lucide-react'
import type { ReactNode } from 'react'

import { useDashboard } from '../context/DashboardContext'
import { RefreshBar } from './RefreshBar'

type PageShellProps = {
  title: string
  eyebrow: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  showRefreshBar?: boolean
}

// Wraps every page so they share the same header rhythm and refresh control.
// Also handles initial loading + load error states uniformly.
export function PageShell({
  title,
  eyebrow,
  description,
  actions,
  children,
  showRefreshBar = true,
}: PageShellProps) {
  const { data, loading, error, reload } = useDashboard()

  if (loading && !data) {
    return <div className="loading">Loading dashboard from Excel…</div>
  }

  if (error && !data) {
    return (
      <section className="surface excel-error-card">
        <AlertTriangle size={24} />
        <h3>Could not load the workbook</h3>
        <p>{error}</p>
        <button className="primary-button" onClick={() => reload()} type="button">
          Try again
        </button>
      </section>
    )
  }

  if (!data) return null

  return (
    <div className="page">
      {showRefreshBar && <RefreshBar />}
      <header className="page-head">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="page-title">{title}</h2>
          {description && <p className="page-description">{description}</p>}
        </div>
        {actions && <div className="page-head-actions">{actions}</div>}
      </header>
      {children}
    </div>
  )
}
