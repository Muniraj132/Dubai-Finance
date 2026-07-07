import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import Layout from './components/layout/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import Auth from './pages/Auth';
import { useAppStore, useSettings } from './stores/useAppStore';
import { useAuthStore } from './stores/useAuthStore';
import { maybeRefreshExchangeRate } from './utils/exchangeRate';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Income = lazy(() => import('./pages/Income'));
const Goals = lazy(() => import('./pages/Goals'));
const GoldTracker = lazy(() => import('./pages/GoldTracker'));
const Investments = lazy(() => import('./pages/Investments'));
const Analytics = lazy(() => import('./pages/Analytics'));
const BudgetPlanner = lazy(() => import('./pages/BudgetPlanner'));
const Converter = lazy(() => import('./pages/Converter'));
const DubaiLife = lazy(() => import('./pages/DubaiLife'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));
const ChitFunds = lazy(() => import('./pages/ChitFund'));

const RouteFallback = () => (
  <div className="min-h-screen bg-main flex items-center justify-center">
    <div className="w-8 h-8 rounded-full border-2 border-[#A6445D] border-t-transparent animate-spin" />
  </div>
);

function AppContent() {
  const { user, loading, initialize: initAuth } = useAuthStore();
  const { theme } = useSettings();
  const initApp = useAppStore((s) => s.initialize);

  useEffect(() => {
    initAuth();
  }, []);

  useEffect(() => {
    if (user) {
      initApp().then(() => maybeRefreshExchangeRate());
    }
  }, [user]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  if (loading) {
    return (
      <div className="min-h-screen bg-main flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#A6445D] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return <Auth />;

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/income" element={<Income />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/gold" element={<GoldTracker />} />
          <Route path="/investments" element={<Investments />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/budget" element={<BudgetPlanner />} />
          <Route path="/converter" element={<Converter />} />
          <Route path="/dubai-life" element={<DubaiLife />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/chit-funds" element={<ChitFunds />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
      <VercelAnalytics />
      <SpeedInsights />
    </BrowserRouter>
  );
}
