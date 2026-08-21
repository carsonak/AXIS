import { Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { BottomNav, Spinner } from './components';
import { useAxis } from './context';
import { RecommendationRefreshProvider } from './recommendation-refresh';
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

function AppLayout() {
  const { online } = useAxis()

  return (
    <RecommendationRefreshProvider>
      <div className="axis-app">
        <div className={`network-strip ${online ? 'online' : 'offline'}`} role="status">
          {online ? 'Online — weather can refresh' : 'Offline — showing saved advice'}
        </div>
        <main className="app-main">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </RecommendationRefreshProvider>
  );
}
