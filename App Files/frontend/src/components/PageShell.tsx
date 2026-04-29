// Wrapper used by every page so they share the same header, refresh bar, and
// loading/error states. Pages call <PageShell title="..."> and render their
// content as children — no boilerplate per page.
import { AlertTriangle } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

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

export function PageShell({
  title,
  eyebrow,
  description,
  actions,
  children,
  showRefreshBar = true,
}: PageShellProps) {
  const { t } = useTranslation()
  const { data, loading, error, reload } = useDashboard()

  if (loading && !data) {
    return <div className="loading">{t('loading.fetching')}</div>
  }

  if (error && !data) {
    return (
      <section className="surface excel-error-card">
        <AlertTriangle size={24} />
        <h3>{t('error.title')}</h3>
        <p>{error}</p>
        <button className="primary-button" onClick={() => reload()} type="button">
          {t('error.retry')}
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
