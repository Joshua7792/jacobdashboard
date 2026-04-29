// Heatmap page — full workers × certifications grid.
//
// Each cell is colored by status (green/yellow/red/blank); hovering shows
// the completion date and days remaining. The first column is sticky so a
// long horizontal scroll keeps worker names visible, and the cert headers
// are written rotated 90° to fit narrow columns.
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PageShell } from '../components/PageShell'
import { useDashboard } from '../context/DashboardContext'
import { formatDate, relativeDays, visualStatus } from '../lib/format'
import type { ExcelHeatmapRow } from '../types'

type SortMode = 'compliance-asc' | 'name' | 'contractor'

export function HeatmapPage() {
  const { t, i18n } = useTranslation()
  const { data } = useDashboard()
  const [contractorFilter, setContractorFilter] = useState('all')
  const [sort, setSort] = useState<SortMode>('contractor')

  const heatmap = data?.heatmap

  const contractors = useMemo(() => {
    if (!heatmap) return []
    return Array.from(new Set(heatmap.rows.map((r) => r.contractor))).sort()
  }, [heatmap])

  const rows = useMemo(() => {
    if (!heatmap) return [] as ExcelHeatmapRow[]
    let list = heatmap.rows
    if (contractorFilter !== 'all') {
      list = list.filter((r) => r.contractor === contractorFilter)
    }
    const compliance = (r: ExcelHeatmapRow) => {
      let g = 0, dated = 0
      r.statuses.forEach((s) => {
        if (s.status === 'green') {
          g++
          dated++
        } else if (s.status === 'yellow' || s.status === 'red') {
          dated++
        }
      })
      return dated > 0 ? g / dated : 0
    }
    const copy = [...list]
    switch (sort) {
      case 'compliance-asc':
        copy.sort((a, b) => compliance(a) - compliance(b))
        break
      case 'name':
        copy.sort((a, b) => a.worker.localeCompare(b.worker))
        break
      case 'contractor':
        copy.sort(
          (a, b) =>
            a.contractor.localeCompare(b.contractor) || a.worker.localeCompare(b.worker),
        )
        break
    }
    return copy
  }, [heatmap, contractorFilter, sort])

  if (!heatmap) return null

  return (
    <PageShell
      eyebrow={t('heatmap.eyebrow')}
      title={t('heatmap.title')}
      description={t('heatmap.description')}
      actions={
        <>
          <select
            aria-label={t('filter.by_contractor')}
            value={contractorFilter}
            onChange={(e) => setContractorFilter(e.target.value)}
          >
            <option value="all">{t('actions.filter_contractor_all')}</option>
            {contractors.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            aria-label={t('filter.sort_heatmap')}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
          >
            <option value="contractor">{t('heatmap.sort_contractor')}</option>
            <option value="compliance-asc">{t('heatmap.sort_compliance_asc')}</option>
            <option value="name">{t('heatmap.sort_name')}</option>
          </select>
        </>
      }
    >
      {rows.length === 0 ? (
        <section className="surface card-padded">
          <p className="excel-empty">{t('heatmap.empty')}</p>
        </section>
      ) : (
        <section className="surface card-padded">
          <div className="excel-heatmap-legend heatmap-legend-row">
            <span className="status-pill status-green">{t('status.current')}</span>
            <span className="status-pill status-yellow">{t('status.renew_soon')}</span>
            <span className="status-pill status-orange">{t('status.urgent')}</span>
            <span className="status-pill status-red">{t('status.overdue')}</span>
            <span className="status-pill status-blank">{t('status.missing')}</span>
          </div>
          <div
            className="excel-heatmap-scroll"
            style={
              {
                '--cert-count': heatmap.cert_names.length,
              } as React.CSSProperties
            }
          >
            <div className="excel-heatmap-grid">
              <div className="excel-heatmap-corner">
                <span className="eyebrow">{t('heatmap.worker_label')}</span>
              </div>
              {heatmap.cert_names.map((name, i) => (
                <div
                  key={`h-${i}`}
                  className="excel-heatmap-header"
                  title={`${name} — ${heatmap.cert_categories[i]}`}
                >
                  <span>{name}</span>
                </div>
              ))}
              {rows.map((row, rIdx) => (
                <RowFragment key={`r-${rIdx}`} row={row} lang={i18n.language} t={t} />
              ))}
            </div>
          </div>
        </section>
      )}
    </PageShell>
  )
}

type RowFragmentProps = {
  row: ExcelHeatmapRow
  lang: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any
}

function RowFragment({ row, lang, t }: RowFragmentProps) {
  return (
    <>
      <div className="excel-heatmap-rowhead">
        <strong>{row.worker}</strong>
        <span>{row.contractor}</span>
      </div>
      {row.statuses.map((cell, cIdx) => (
        <div
          key={`c-${cIdx}`}
          className={`excel-heatmap-cell status-${visualStatus(cell.status, cell.days_until_anniversary)}`}
          title={
            cell.completed_on
              ? t('heatmap.completed_relative', {
                  date: formatDate(cell.completed_on, lang),
                  relative: relativeDays(cell.days_until_anniversary, t),
                })
              : t('heatmap.no_date')
          }
        >
          {cell.completed_on ? (
            <span className="excel-heatmap-cell-text">
              {formatDate(cell.completed_on, lang)}
            </span>
          ) : null}
        </div>
      ))}
    </>
  )
}
