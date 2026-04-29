// Two reusable status visualizations:
//   - StatusPill: a colored badge ("Current", "Renew soon", "Urgent", "Overdue", "Missing")
//   - StatusStackedBar: a horizontal bar showing the cert-status mix at a glance
//
// Both pull labels from the i18n catalog via useTranslation, so they switch
// language automatically.
import { useTranslation } from 'react-i18next'

import { statusLabel } from '../lib/format'
import type { ExcelVisualStatus } from '../types'

export function StatusPill({ status }: { status: ExcelVisualStatus }) {
  const { t } = useTranslation()
  return <span className={`status-pill status-${status}`}>{statusLabel(status, t)}</span>
}

type StatusBarProps = {
  green: number
  yellow: number
  red: number
  blank: number
  showLabels?: boolean
}

export function StatusStackedBar({ green, yellow, red, blank, showLabels }: StatusBarProps) {
  const { t } = useTranslation()
  const total = green + yellow + red + blank
  if (total === 0) {
    return <div className="status-stacked-bar empty" aria-label={t('status.missing')} />
  }
  const pct = (n: number) => (n / total) * 100
  return (
    <div className="status-stacked-wrap">
      <div className="status-stacked-bar" role="img" aria-label={t('certifications.col_status_mix')}>
        {green > 0 && (
          <span
            className="seg seg-green"
            style={{ width: `${pct(green)}%` }}
            title={`${green} ${t('status.current')}`}
          />
        )}
        {yellow > 0 && (
          <span
            className="seg seg-yellow"
            style={{ width: `${pct(yellow)}%` }}
            title={`${yellow} ${t('status.renew_soon')}`}
          />
        )}
        {red > 0 && (
          <span
            className="seg seg-red"
            style={{ width: `${pct(red)}%` }}
            title={`${red} ${t('status.overdue')}`}
          />
        )}
        {blank > 0 && (
          <span
            className="seg seg-blank"
            style={{ width: `${pct(blank)}%` }}
            title={`${blank} ${t('status.missing')}`}
          />
        )}
      </div>
      {showLabels && (
        <div className="status-stacked-labels">
          <span className="dot dot-green" /> {green}
          <span className="dot dot-yellow" /> {yellow}
          <span className="dot dot-red" /> {red}
          <span className="dot dot-blank" /> {blank}
        </div>
      )}
    </div>
  )
}
