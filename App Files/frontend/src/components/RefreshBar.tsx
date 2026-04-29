// Top-of-page bar showing the current workbook + last-loaded time, with a
// Refresh button that calls /api/excel/refresh and re-reads the dashboard.
import { AlertTriangle, Clock, FileSpreadsheet, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useDashboard } from '../context/DashboardContext'
import { formatTime } from '../lib/format'

export function RefreshBar() {
  const { t, i18n } = useTranslation()
  const { data, refreshing, error, refresh } = useDashboard()
  if (!data) return null

  const fileName = data.workbook.path.split(/[\\/]/).pop() ?? data.workbook.path

  return (
    <div className="excel-refresh-bar surface">
      <div className="excel-refresh-info">
        <span className="excel-refresh-icon">
          <FileSpreadsheet size={18} />
        </span>
        <div>
          <p className="eyebrow">{t('refresh.workbook')}</p>
          <strong>{fileName}</strong>
          <p className="excel-refresh-meta">
            <Clock size={13} />{' '}
            {t('refresh.last_loaded', { time: formatTime(data.workbook.loaded_at, i18n.language) })}
          </p>
        </div>
      </div>
      <button
        type="button"
        className="primary-button excel-refresh-button"
        onClick={() => refresh()}
        disabled={refreshing}
      >
        <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
        {refreshing ? t('refresh.button_loading') : t('refresh.button_idle')}
      </button>
      {error ? (
        <div className="excel-refresh-error">
          <AlertTriangle size={14} /> {error}
        </div>
      ) : null}
    </div>
  )
}
