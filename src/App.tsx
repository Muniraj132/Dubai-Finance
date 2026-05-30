import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
import { useSettings } from './stores/useAppStore';
import { useEffect } from 'react';

function ThemeApplier() {
  const { theme } = useSettings();
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeApplier />
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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
