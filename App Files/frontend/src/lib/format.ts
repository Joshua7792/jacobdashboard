// Display helpers shared across pages.
// All four are pure: same input → same output. Keep that property when adding.
import type { ExcelStatus } from '../types'

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function relativeDays(days: number | null): string {
  if (days === null || days === undefined) return '—'
  if (days === 0) return 'today'
  if (days > 0) return `in ${days}d`
  return `${Math.abs(days)}d ago`
}

export function statusLabel(s: ExcelStatus): string {
  switch (s) {
    case 'green':
      return 'Current'
    case 'yellow':
      return 'Renew soon'
    case 'red':
      return 'Urgent'
    default:
      return 'Missing'
  }
}

export const STATUS_COLOR: Record<ExcelStatus, string> = {
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
  blank: '#94a3b8',
}
