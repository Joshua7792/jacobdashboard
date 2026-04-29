// Display helpers shared across pages.
// All four are pure: same input → same output. Keep that property when adding.
import type { ExcelStatus, ExcelVisualStatus } from '../types'

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

export function visualStatus(status: ExcelStatus, days: number | null): ExcelVisualStatus {
  if (status === 'red' && days !== null && days >= 0) return 'orange'
  return status
}

export function statusLabel(s: ExcelVisualStatus): string {
  switch (s) {
    case 'green':
      return 'Current'
    case 'yellow':
      return 'Renew soon'
    case 'orange':
      return 'Urgent'
    case 'red':
      return 'Overdue'
    default:
      return 'Missing'
  }
}

export const STATUS_COLOR: Record<ExcelVisualStatus, string> = {
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
  orange: '#f97316',
  blank: '#94a3b8',
}
