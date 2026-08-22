import { useEffect } from 'react';
import { Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { BottomNav, Spinner, AIChatAssistant, NetworkStatusDot } from './components';
import { useAxis } from './context';
import { RecommendationRefreshProvider, useRecommendationRefresh } from './recommendation-refresh';
import { decisionSnapshotService } from './decision-snapshots';
import LandingPage from './pages/LandingPage';
import TodayPage from './pages/TodayPage';
import PlotsPage from './pages/PlotsPage';
import PlotFormPage from './pages/PlotFormPage';
import CropDetailsPage from './pages/CropDetailsPage';
import HistoryPage from './pages/HistoryPage';
import WaterUsagePage from './pages/WaterUsagePage';
import SoilMoisturePage from './pages/SoilMoisturePage';
import WeatherPage from './pages/WeatherPage';
import AlertsPage from './pages/AlertsPage';
import RecommendationsPage from './pages/RecommendationsPage';
import MorePage from './pages/MorePage';
import './App.css';

export default function App() {
  const { ready } = useAxis()
  useDailyFinalization(ready)

  if (!ready) {
    return <div className="boot"><Spinner label="Opening your saved farm data…" /></div>
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<TodayPage />} />
        <Route path="plots" element={<PlotsPage />} />
        <Route path="plots/new" element={<PlotFormPage />} />
        <Route path="plots/:plotId" element={<PlotFormPage />} />
        <Route path="plots/:plotId/details" element={<CropDetailsPage />} />
        <Route path="water" element={<WaterUsagePage />} />
        <Route path="soil" element={<SoilMoisturePage />} />
        <Route path="weather" element={<WeatherPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="recommendations" element={<RecommendationsPage />} />
        <Route path="more" element={<MorePage />} />
      </Route>
      <Route path="/plots" element={<Navigate to="/app/plots" replace />} />
      <Route path="/history" element={<Navigate to="/app/history" replace />} />
      <Route path="/more" element={<Navigate to="/app/more" replace />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}

function useDailyFinalization(ready: boolean) {
  useEffect(() => {
    if (!ready) return
    const run = () => {
      if (document.visibilityState !== 'visible') return
      void decisionSnapshotService.finalizeEligibleDays().catch(() => {
        console.error('Daily decision snapshot finalization failed.')
      })
    }
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') run() }
    run()
    const interval = window.setInterval(run, 60_000)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', run)
    window.addEventListener('online', run)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', run)
      window.removeEventListener('online', run)
    }
  }, [ready])
}

function AppLayout() {
  return (
    <RecommendationRefreshProvider>
      <AppLayoutContent />
    </RecommendationRefreshProvider>
  )
}

function AppLayoutContent() {
  const { online, selectedPlot, health } = useAxis()
  const { recommendation, localReady } = useRecommendationRefresh()

  return (
    <div className="axis-app">
      <main className="app-main">
        <Outlet />
      </main>
      <NetworkStatusDot online={online} />
      <AIChatAssistant
        selectedPlot={selectedPlot}
        recommendation={recommendation}
        recommendationReady={localReady}
        online={online}
        aiEnabled={health?.ai_insights_enabled}
      />
      <BottomNav />
    </div>
  );
}
