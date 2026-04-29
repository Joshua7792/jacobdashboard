// App chrome: dark sidebar with nav + at-a-glance stats, content area on the right.
// Every page renders inside <main>, so this component is the constant frame.
//
// The sidebar also hosts the two global preferences:
//   - Language toggle (EN / ES) — persists via i18next-browser-languagedetector
//   - Theme toggle (light / dark) — persists via ThemeContext
import {
  AlertTriangle,
  BriefcaseBusiness,
  Grid3x3,
  LayoutDashboard,
  Moon,
  ShieldCheck,
  Sun,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'

import { useDashboard } from '../context/DashboardContext'
import { useTheme } from '../context/ThemeContext'

type ShellLayoutProps = {
  children: ReactNode
}

export function ShellLayout({ children }: ShellLayoutProps) {
  const { t, i18n } = useTranslation()
  const { data } = useDashboard()
  const { theme, toggle: toggleTheme } = useTheme()

  // Built once per render so labels follow the active language.
  const navigation = [
    { to: '/', label: t('nav.overview'), icon: LayoutDashboard, end: true },
    { to: '/actions', label: t('nav.actions'), icon: AlertTriangle },
    { to: '/contractors', label: t('nav.contractors'), icon: BriefcaseBusiness },
    { to: '/workers', label: t('nav.workers'), icon: Users },
    { to: '/certifications', label: t('nav.certifications'), icon: ShieldCheck },
    { to: '/heatmap', label: t('nav.heatmap'), icon: Grid3x3 },
  ]

  const lang = i18n.language?.startsWith('es') ? 'es' : 'en'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-panel">
          <div className="brand-mark">CO</div>
          <div>
            <p className="eyebrow">{t('app.brand_eyebrow')}</p>
            <h1>{t('app.brand_title')}</h1>
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
            <p className="eyebrow">{t('app.at_a_glance')}</p>
            <div className="sidebar-stat-row">
              <span>{t('app.stat_workers')}</span>
              <strong>{data.kpis.active_workers}</strong>
            </div>
            <div className="sidebar-stat-row">
              <span>{t('app.stat_contractors')}</span>
              <strong>{data.kpis.total_contractors}</strong>
            </div>
            <div className="sidebar-stat-row">
              <span>{t('app.stat_compliance')}</span>
              <strong>{data.kpis.overall_compliance_pct.toFixed(1)}%</strong>
            </div>
            <div className="sidebar-stat-row">
              <span>{t('app.stat_urgent')}</span>
              <strong className={data.kpis.red_count > 0 ? 'tone-bad-text' : ''}>
                {data.kpis.red_count}
              </strong>
            </div>
          </div>
        )}

        <div className="sidebar-prefs surface">
          <div className="sidebar-pref-row">
            <span className="eyebrow">{t('app.language')}</span>
            <div className="sidebar-toggle" role="group" aria-label={t('app.language')}>
              <button
                type="button"
                className={`sidebar-toggle-btn ${lang === 'en' ? 'active' : ''}`}
                onClick={() => i18n.changeLanguage('en')}
                aria-pressed={lang === 'en' ? 'true' : 'false'}
              >
                EN
              </button>
              <button
                type="button"
                className={`sidebar-toggle-btn ${lang === 'es' ? 'active' : ''}`}
                onClick={() => i18n.changeLanguage('es')}
                aria-pressed={lang === 'es' ? 'true' : 'false'}
              >
                ES
              </button>
            </div>
          </div>

          <div className="sidebar-pref-row">
            <span className="eyebrow">{t('app.theme')}</span>
            <button
              type="button"
              className="sidebar-theme-btn"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? t('app.theme_light') : t('app.theme_dark')}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              <span>{theme === 'dark' ? t('app.theme_light') : t('app.theme_dark')}</span>
            </button>
          </div>
        </div>

        <div className="sidebar-note surface">
          <p className="eyebrow">{t('app.how_it_works_title')}</p>
          <p>{t('app.how_it_works_body')}</p>
        </div>
      </aside>

      <main className="main-stage">
        <div className="page-content">{children}</div>
      </main>
    </div>
  )
}
