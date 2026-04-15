import { Suspense, lazy, useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { api } from './api'
import './App.css'
import { ShellLayout } from './components/ShellLayout'
import { CompaniesPage } from './pages/CompaniesPage'
import { ContractorsPage } from './pages/ContractorsPage'
import { WorkersPage } from './pages/WorkersPage'
import type { Company } from './types'

const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })),
)
const CertificationsPage = lazy(() =>
  import('./pages/CertificationsPage').then((module) => ({
    default: module.CertificationsPage,
  })),
)
const ReportsPage = lazy(() =>
  import('./pages/ReportsPage').then((module) => ({ default: module.ReportsPage })),
)
const TrainingHubPage = lazy(() =>
  import('./pages/TrainingHubPage').then((module) => ({ default: module.TrainingHubPage })),
)

function App() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadCompanies() {
    try {
      setError(null)
      const data = await api.getCompanies()
      setCompanies(data)
      if (selectedCompanyId && !data.some((company) => company.id === selectedCompanyId)) {
        setSelectedCompanyId(null)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load companies')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCompanies()
  }, [])

  if (loading) {
    return <div className="app-loading">Preparing your local dashboard...</div>
  }

  return (
    <BrowserRouter>
      <ShellLayout
        companies={companies}
        selectedCompanyId={selectedCompanyId}
        onSelectCompany={setSelectedCompanyId}
      >
        {error && <div className="error-banner">{error}</div>}
        <Suspense fallback={<div className="loading">Loading page...</div>}>
          <Routes>
            <Route path="/" element={<DashboardPage selectedCompanyId={selectedCompanyId} />} />
            <Route
              path="/companies"
              element={<CompaniesPage companies={companies} onRefresh={loadCompanies} />}
            />
            <Route
              path="/contractors"
              element={
                <ContractorsPage
                  companies={companies}
                  selectedCompanyId={selectedCompanyId}
                />
              }
            />
            <Route
              path="/employees"
              element={
                <WorkersPage companies={companies} selectedCompanyId={selectedCompanyId} />
              }
            />
            <Route
              path="/training"
              element={<TrainingHubPage selectedCompanyId={selectedCompanyId} />}
            />
            <Route
              path="/workers"
              element={
                <WorkersPage companies={companies} selectedCompanyId={selectedCompanyId} />
              }
            />
            <Route
              path="/certifications"
              element={<CertificationsPage selectedCompanyId={selectedCompanyId} />}
            />
            <Route
              path="/reports"
              element={<ReportsPage selectedCompanyId={selectedCompanyId} />}
            />
          </Routes>
        </Suspense>
      </ShellLayout>
    </BrowserRouter>
  )
}

export default App
