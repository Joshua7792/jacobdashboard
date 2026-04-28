import { BrowserRouter, Route, Routes } from 'react-router-dom'

import './App.css'
import { ShellLayout } from './components/ShellLayout'
import { ExcelDashboardPage } from './pages/ExcelDashboardPage'

function App() {
  return (
    <BrowserRouter>
      <ShellLayout>
        <Routes>
          <Route path="/" element={<ExcelDashboardPage />} />
          <Route path="*" element={<ExcelDashboardPage />} />
        </Routes>
      </ShellLayout>
    </BrowserRouter>
  )
}

export default App
