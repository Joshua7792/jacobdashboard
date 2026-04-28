// Two reusable status visualizations:
//   - StatusPill: a colored badge ("Current", "Renew soon", "Urgent", "Missing")
//   - StatusStackedBar: a horizontal bar showing the cert-status mix at a glance
import type { ExcelStatus } from '../types'
import { statusLabel } from '../lib/format'

export function StatusPill({ status }: { status: ExcelStatus }) {
  return <span className={`status-pill status-${status}`}>{statusLabel(status)}</span>
}

type StatusBarProps = {
  green: number
  yellow: number
  red: number
  blank: number
  showLabels?: boolean
}

// Stacked horizontal bar: visual breakdown of cert status counts.
export function StatusStackedBar({ green, yellow, red, blank, showLabels }: StatusBarProps) {
  const total = green + yellow + red + blank
  if (total === 0) {
    return <div className="status-stacked-bar empty" aria-label="No data" />
  }
  const pct = (n: number) => (n / total) * 100
  return (
    <div className="status-stacked-wrap">
      <div className="status-stacked-bar" role="img" aria-label="Cert status breakdown">
        {green > 0 && <span className="seg seg-green" style={{ width: `${pct(green)}%` }} title={`${green} current`} />}
        {yellow > 0 && <span className="seg seg-yellow" style={{ width: `${pct(yellow)}%` }} title={`${yellow} renew soon`} />}
        {red > 0 && <span className="seg seg-red" style={{ width: `${pct(red)}%` }} title={`${red} urgent`} />}
        {blank > 0 && <span className="seg seg-blank" style={{ width: `${pct(blank)}%` }} title={`${blank} missing`} />}
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
