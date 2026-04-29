// Display helpers shared across pages.
//
// formatDate / formatTime accept an optional locale string ('en', 'es') so
// dates render in the user's chosen language. relativeDays and statusLabel
// take the i18n ``t`` function as a parameter — pass it from useTranslation
// at the call site so the strings are translated.
import type { TFunction } from 'i18next'

import type { ExcelStatus, ExcelVisualStatus } from '../types'

function resolveLocale(lang?: string): string | undefined {
  // i18next gives us 'en' or 'es'. toLocaleDateString accepts BCP 47, so a
  // bare 'en' / 'es' is fine and lets the browser pick a sensible variant.
  return lang || undefined
}

export function formatDate(iso: string | null, lang?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(resolveLocale(lang), {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

export function formatTime(iso: string, lang?: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleTimeString(resolveLocale(lang), {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function relativeDays(days: number | null, t: TFunction): string {
  if (days === null || days === undefined) return '—'
  if (days === 0) return t('relative.today')
  if (days > 0) return t('relative.in_days', { count: days })
  return t('relative.days_ago', { count: Math.abs(days) })
}

export function visualStatus(status: ExcelStatus, days: number | null): ExcelVisualStatus {
  if (status === 'red' && days !== null && days >= 0) return 'orange'
  return status
}

export function statusLabel(s: ExcelVisualStatus, t: TFunction): string {
  switch (s) {
    case 'green':
      return t('status.current')
    case 'yellow':
      return t('status.renew_soon')
    case 'orange':
      return t('status.urgent')
    case 'red':
      return t('status.overdue')
    default:
      return t('status.missing')
  }
}

export const STATUS_COLOR: Record<ExcelVisualStatus, string> = {
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
  orange: '#f97316',
  blank: '#94a3b8',
}
