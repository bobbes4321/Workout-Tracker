import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import { seedIfEmpty, requestPersistentStorage } from './lib/db'
import { maybeDailySnapshot } from './lib/backup'
import { DialogProvider } from './components/Dialog'
import { Layout } from './components/Layout'
import { DashboardPage } from './pages/DashboardPage'
import { LogPage } from './pages/LogPage'
import { HistoryPage } from './pages/HistoryPage'
import { ProgressPage } from './pages/ProgressPage'
import { RecordsPage } from './pages/RecordsPage'
import { SettingsPage } from './pages/SettingsPage'

// Fire-and-forget startup chores: seed on first run, ask the browser to keep
// our data from being evicted, then take at most one snapshot per day.
void (async () => {
  await seedIfEmpty()
  await requestPersistentStorage()
  await maybeDailySnapshot()
})()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <DialogProvider>
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
      </DialogProvider>
    </HashRouter>
  </StrictMode>,
)
