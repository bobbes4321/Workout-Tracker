import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import { seedIfEmpty } from './lib/db'
import { Layout } from './components/Layout'
import { DashboardPage } from './pages/DashboardPage'
import { LogPage } from './pages/LogPage'
import { HistoryPage } from './pages/HistoryPage'
import { ProgressPage } from './pages/ProgressPage'
import { RecordsPage } from './pages/RecordsPage'
import { SettingsPage } from './pages/SettingsPage'

seedIfEmpty()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/log" element={<LogPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/records" element={<RecordsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  </StrictMode>,
)
