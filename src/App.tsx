import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Income from './pages/Income';
import Goals from './pages/Goals';
import GoldTracker from './pages/GoldTracker';
import Analytics from './pages/Analytics';
import BudgetPlanner from './pages/BudgetPlanner';
import Converter from './pages/Converter';
import DubaiLife from './pages/DubaiLife';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import ChitFunds from './pages/ChitFund';
import Auth from './pages/Auth';
import { useAppStore, useSettings } from './stores/useAppStore';
import { useAuthStore } from './stores/useAuthStore';

function AppContent() {
  const { user, loading, initialize: initAuth } = useAuthStore();
  const { theme } = useSettings();
  const initApp = useAppStore((s) => s.initialize);

  useEffect(() => {
    initAuth();
  }, []);

  useEffect(() => {
    if (user) initApp();
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
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/income" element={<Income />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/gold" element={<GoldTracker />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/budget" element={<BudgetPlanner />} />
        <Route path="/converter" element={<Converter />} />
        <Route path="/dubai-life" element={<DubaiLife />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/chit-funds" element={<ChitFunds />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
      <VercelAnalytics />
      <SpeedInsights />
    </BrowserRouter>
  );
}
