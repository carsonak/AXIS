import { Navigate, Route, Routes } from 'react-router-dom'
import { AxisMark, BottomNav, Spinner } from './components'
import { useAxis } from './context'
import TodayPage from './pages/TodayPage'
import PlotsPage from './pages/PlotsPage'
import PlotFormPage from './pages/PlotFormPage'
import HistoryPage from './pages/HistoryPage'
import MorePage from './pages/MorePage'

export default function App() {
  const { ready, online } = useAxis()
  if (!ready) return <div className="boot"><AxisMark /><Spinner label="Opening your saved farm data…" /></div>
  return <div className="app-shell"><div className={`network-strip ${online ? 'online' : 'offline'}`}>{online ? 'Online — weather can refresh' : 'Offline — showing saved advice'}</div><Routes>
    <Route path="/" element={<TodayPage />} />
    <Route path="/plots" element={<PlotsPage />} />
    <Route path="/plots/new" element={<PlotFormPage />} />
    <Route path="/plots/:plotId" element={<PlotFormPage />} />
    <Route path="/history" element={<HistoryPage />} />
    <Route path="/more" element={<MorePage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes><BottomNav /></div>
}
