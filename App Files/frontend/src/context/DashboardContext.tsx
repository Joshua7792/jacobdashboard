// Single source of truth for the parsed workbook.
//
// Every page reads from the same DashboardContext, so navigating between
// pages does NOT refetch. The user explicitly hits "Refresh" (which calls
// /api/excel/refresh and then re-reads /api/excel/dashboard) when they
// want to pull updates from a freshly-saved workbook.
//
//   loading   — first load, show a spinner
//   refreshing — subsequent reload while the old data is still on screen
//   error     — last fetch failed; if data is null we render an error card
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

import { api } from '../api'
import type { ExcelDashboard } from '../types'

type Ctx = {
  data: ExcelDashboard | null
  loading: boolean
  refreshing: boolean
  error: string | null
  refresh: () => Promise<void>
  reload: () => Promise<void>
}

const DashboardContext = createContext<Ctx | undefined>(undefined)

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ExcelDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (force: boolean) => {
    try {
      if (data) setRefreshing(true)
      else setLoading(true)
      setError(null)
      if (force) {
        await api.refreshExcelWorkbook()
      }
      const fresh = await api.getExcelDashboard()
      setData(fresh)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load dashboard')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [data])

  useEffect(() => {
    load(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value: Ctx = {
    data,
    loading,
    refreshing,
    error,
    refresh: () => load(true),
    reload: () => load(false),
  }

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
}

export function useDashboard(): Ctx {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboard must be used inside DashboardProvider')
  return ctx
}
