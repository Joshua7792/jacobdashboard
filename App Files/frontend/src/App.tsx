// Top-level routing for the dashboard.
//
// All pages share a single ExcelDashboard payload provided by
// DashboardProvider, so navigating between pages does NOT refetch the
// workbook. The user clicks Refresh on any page to reload from disk.
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import './App.css'
import { ShellLayout } from './components/ShellLayout'
import { DashboardProvider } from './context/DashboardContext'
import { ActionsPage } from './pages/ActionsPage'
import { CertificationsPage } from './pages/CertificationsPage'
import { ContractorsPage } from './pages/ContractorsPage'
import { HeatmapPage } from './pages/HeatmapPage'
import { OverviewPage } from './pages/OverviewPage'
import { WorkersPage } from './pages/WorkersPage'

function App() {
  return (
    <BrowserRouter>
      <DashboardProvider>
        <ShellLayout>
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/actions" element={<ActionsPage />} />
            <Route path="/contractors" element={<ContractorsPage />} />
            <Route path="/workers" element={<WorkersPage />} />
            <Route path="/certifications" element={<CertificationsPage />} />
            <Route path="/heatmap" element={<HeatmapPage />} />
            {/* Unknown route → bounce home. Keeps the URL bar honest. */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ShellLayout>
      </DashboardProvider>
    </BrowserRouter>
  )
}

export default App
